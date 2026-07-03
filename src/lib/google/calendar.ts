// =============================================================================
// Integração com Google Calendar (esqueleto).
//
// No protótipo, `getAvailability` retorna slots simulados para o fluxo rodar
// ponta a ponta. Em produção, troque o corpo por chamadas à Google Calendar
// API (freebusy.query para disponibilidade, events.insert para criar o evento)
// usando o access_token guardado em `professional_integration`.
// =============================================================================

export interface Slot {
  startsAt: string; // ISO 8601
  endsAt: string;
  label: string; // "quinta, 12/07 às 9h"
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Formata um Date como "quinta, 12/07 às 9h" (pt-BR). */
function label(d: Date): string {
  const dia = DIAS[d.getDay()];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = d.getHours();
  return `${dia}, ${dd}/${mm} às ${hh}h`;
}

/**
 * Retorna próximos horários livres. STUB: gera 3 slots nos próximos dias úteis.
 * Em produção: consultar freebusy do calendar_id da integração.
 */
export async function getAvailability(
  _professionalId: string,
  durationMinutes = 50,
): Promise<Slot[]> {
  const slots: Slot[] = [];
  const base = new Date();
  const hours = [9, 14, 16];
  let added = 0;
  for (let day = 1; day <= 7 && added < 3; day++) {
    const d = new Date(base);
    d.setDate(base.getDate() + day);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // pula fim de semana
    const start = new Date(d);
    start.setHours(hours[added % hours.length], 0, 0, 0);
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    slots.push({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      label: label(start),
    });
    added++;
  }
  return slots;
}

export interface CreatedEvent {
  gcalEventId: string;
  meetingUrl?: string;
}

/**
 * Cria o evento na agenda. STUB: retorna id fake. Em produção: events.insert
 * com conferenceData para gerar link do Google Meet.
 */
export async function createEvent(
  _professionalId: string,
  slot: Slot,
  _summary: string,
): Promise<CreatedEvent> {
  return {
    gcalEventId: `stub_${Date.parse(slot.startsAt)}`,
    meetingUrl: undefined,
  };
}
