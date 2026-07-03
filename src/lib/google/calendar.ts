// Integração Google Calendar (esqueleto). Modo protótipo: slots simulados.
// Em produção: freebusy.query (disponibilidade) + events.insert (evento + Meet),
// usando o token de professional_integration.

export interface Slot {
  startsAt: string;
  endsAt: string;
  label: string; // "quinta, 12/07 às 9h"
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function label(d: Date): string {
  return `${DIAS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(
    d.getMonth() + 1,
  ).padStart(2, '0')} às ${d.getHours()}h`;
}

export async function getAvailability(durationMinutes = 50): Promise<Slot[]> {
  const slots: Slot[] = [];
  const base = new Date();
  const hours = [9, 14, 16];
  let added = 0;
  for (let day = 1; day <= 7 && added < 3; day++) {
    const d = new Date(base);
    d.setDate(base.getDate() + day);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    d.setHours(hours[added % hours.length], 0, 0, 0);
    const end = new Date(d.getTime() + durationMinutes * 60_000);
    slots.push({ startsAt: d.toISOString(), endsAt: end.toISOString(), label: label(d) });
    added++;
  }
  return slots;
}

export async function createEvent(
  slot: Slot,
  _summary: string,
): Promise<{ gcalEventId: string; meetingUrl?: string }> {
  return { gcalEventId: `stub_${Date.parse(slot.startsAt)}` };
}
