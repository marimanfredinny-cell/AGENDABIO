// =============================================================================
// Google Calendar — disponibilidade (freebusy) + criação de evento (com Meet).
// Se o profissional NÃO tem o Google conectado (ou faltam credenciais/env),
// cai para slots SIMULADOS — assim o modo demo e o dev local seguem rodando.
// =============================================================================

import { google } from 'googleapis';
import { randomUUID } from 'crypto';
import { store } from '@/lib/store';
import type { GoogleIntegration } from '@/lib/store/types';
import { hasGoogleEnv, oauthClient } from './oauth';

export interface Slot {
  startsAt: string; // ISO (UTC)
  endsAt: string;
  label: string; // "quinta, 12/07 às 09h" (no fuso do profissional)
}

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const DAYS_AHEAD = 14;
const MAX_SLOTS = 6;

// ---- Helpers de fuso -------------------------------------------------------

// Offset (ms) do fuso `tz` no instante `date`.
function tzOffsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}

// Converte um horário de parede (no fuso tz) para o instante UTC correspondente.
function wallToUtc(tz: string, y: number, mo: number, d: number, h: number, min = 0): Date {
  const guess = Date.UTC(y, mo - 1, d, h, min);
  const offset = tzOffsetMs(tz, new Date(guess));
  return new Date(guess - offset);
}

function labelInTz(tz: string, iso: string): string {
  const d = new Date(iso);
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
  }).formatToParts(d)) {
    p[part.type] = part.value;
  }
  const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone: tz, weekday: 'long' }).format(d);
  return `${weekday}, ${p.day}/${p.month} às ${p.hour}h${p.minute !== '00' ? p.minute : ''}`;
}

// Nome curto do dia da semana em EN (para detectar fim de semana no fuso).
function weekdayShort(tz: string, d: Date): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
}

// Componentes de data (ano/mês/dia) de um instante já no fuso `tz`.
function tzDateParts(tz: string, d: Date): { y: number; mo: number; day: number } {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)) {
    p[part.type] = part.value;
  }
  return { y: +p.year, mo: +p.month, day: +p.day };
}

// ---- Cliente autenticado ---------------------------------------------------

async function calendarClient(professionalId: string, integ: GoogleIntegration) {
  const client = oauthClient();
  client.setCredentials({
    access_token: integ.access_token ?? undefined,
    refresh_token: integ.refresh_token ?? undefined,
    expiry_date: integ.expires_at ? Date.parse(integ.expires_at) : undefined,
  });
  // Persiste tokens renovados automaticamente pela lib.
  client.on('tokens', (t) => {
    void store.saveGoogleTokens(professionalId, {
      access_token: t.access_token ?? undefined,
      refresh_token: t.refresh_token ?? undefined,
      expires_at: t.expiry_date ? new Date(t.expiry_date).toISOString() : undefined,
    });
  });
  return google.calendar({ version: 'v3', auth: client });
}

// ---- Slots simulados (fallback) -------------------------------------------

function simulatedSlots(tz: string, durationMinutes: number): Slot[] {
  const slots: Slot[] = [];
  const now = new Date();
  const hours = [9, 14, 16];
  let added = 0;
  for (let day = 1; day <= 7 && added < 3; day++) {
    const base = new Date(now.getTime() + day * 86_400_000);
    const wd = weekdayShort(tz, base);
    if (wd === 'Sat' || wd === 'Sun') continue;
    const { y, mo, day: dd } = tzDateParts(tz, base);
    const start = wallToUtc(tz, y, mo, dd, hours[added % hours.length]);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    slots.push({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      label: labelInTz(tz, start.toISOString()),
    });
    added++;
  }
  return slots;
}

// ---- API pública -----------------------------------------------------------

export async function getAvailability(opts: {
  professionalId: string;
  timezone: string;
  durationMinutes: number;
}): Promise<Slot[]> {
  const integ = hasGoogleEnv() ? await store.getGoogleIntegration(opts.professionalId) : null;
  if (!integ || !integ.refresh_token) {
    return simulatedSlots(opts.timezone, opts.durationMinutes);
  }

  const cal = await calendarClient(opts.professionalId, integ);
  const timeMin = new Date();
  const timeMax = new Date(timeMin.getTime() + DAYS_AHEAD * 86_400_000);

  const fb = await cal.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      timeZone: opts.timezone,
      items: [{ id: integ.calendar_id }],
    },
  });
  const busy = (fb.data.calendars?.[integ.calendar_id]?.busy ?? []).map((b) => ({
    start: Date.parse(b.start!),
    end: Date.parse(b.end!),
  }));

  const overlaps = (s: number, e: number) => busy.some((b) => s < b.end && e > b.start);

  const slots: Slot[] = [];
  for (let day = 1; day <= DAYS_AHEAD && slots.length < MAX_SLOTS; day++) {
    const ref = new Date(timeMin.getTime() + day * 86_400_000);
    const weekdayName = weekdayShort(opts.timezone, ref);
    if (weekdayName === 'Sat' || weekdayName === 'Sun') continue;

    const { y, mo, day: d } = tzDateParts(opts.timezone, ref);

    for (let h = WORK_START_HOUR; h + opts.durationMinutes / 60 <= WORK_END_HOUR; h++) {
      if (slots.length >= MAX_SLOTS) break;
      const start = wallToUtc(opts.timezone, y, mo, d, h);
      if (start.getTime() < Date.now()) continue;
      const end = new Date(start.getTime() + opts.durationMinutes * 60_000);
      if (overlaps(start.getTime(), end.getTime())) continue;
      slots.push({
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        label: labelInTz(opts.timezone, start.toISOString()),
      });
    }
  }
  return slots;
}

export async function createEvent(opts: {
  professionalId: string;
  timezone: string;
  slot: Slot;
  summary: string;
  attendeeEmail?: string | null;
  modality: 'online' | 'presencial';
}): Promise<{ gcalEventId: string; meetingUrl?: string }> {
  const integ = hasGoogleEnv() ? await store.getGoogleIntegration(opts.professionalId) : null;
  if (!integ || !integ.refresh_token) {
    return { gcalEventId: `stub_${Date.parse(opts.slot.startsAt)}` };
  }

  const cal = await calendarClient(opts.professionalId, integ);
  const wantMeet = opts.modality === 'online';

  const res = await cal.events.insert({
    calendarId: integ.calendar_id,
    conferenceDataVersion: wantMeet ? 1 : 0,
    sendUpdates: 'all',
    requestBody: {
      summary: opts.summary,
      start: { dateTime: opts.slot.startsAt, timeZone: opts.timezone },
      end: { dateTime: opts.slot.endsAt, timeZone: opts.timezone },
      attendees: opts.attendeeEmail ? [{ email: opts.attendeeEmail }] : undefined,
      conferenceData: wantMeet
        ? { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }
        : undefined,
    },
  });

  return {
    gcalEventId: res.data.id!,
    meetingUrl: res.data.hangoutLink ?? undefined,
  };
}
