// =============================================================================
// Envio de WhatsApp via Twilio (esqueleto).
// Em produção, use o SDK oficial da Twilio ou a API do WhatsApp Business Cloud.
// A fila de mensagens vive na tabela `notification`; este módulo só entrega.
// =============================================================================

export interface SendResult {
  providerMessageId: string;
}

export async function sendWhatsApp(
  to: string,
  body: string,
  from?: string,
): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = from ?? process.env.TWILIO_WHATSAPP_FROM;

  // Sem credenciais (protótipo local): apenas loga e finge sucesso.
  if (!sid || !token || !fromNumber) {
    console.log(`[whatsapp:stub] para ${to} de ${fromNumber}: ${body}`);
    return { providerMessageId: `stub_${Date.now()}` };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const params = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: `whatsapp:${fromNumber}`,
    Body: body,
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });
  if (!res.ok) {
    throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { sid: string };
  return { providerMessageId: data.sid };
}
