// Envio de e-mail via Resend. Sem RESEND_API_KEY, apenas loga (modo protótipo).
import { USE_RESEND } from '@/lib/config';

export async function sendEmail(opts: {
  to: string;
  subject: string;
  body: string;
  from?: string;
}): Promise<{ id: string }> {
  if (!USE_RESEND) {
    console.log(`[email:stub] para ${opts.to} | ${opts.subject}\n${opts.body}`);
    return { id: `stub_${Date.now()}` };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: opts.from ?? process.env.RESEND_FROM ?? 'AgendaBio <no-reply@agendabio.com.br>',
      to: opts.to,
      subject: opts.subject,
      text: opts.body,
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}
