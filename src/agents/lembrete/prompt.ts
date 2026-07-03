// =============================================================================
// AGENTE DE LEMBRETE (via e-mail nesta fase).
// Não é conversacional: é acionado pelo cron para gerar o texto do e-mail
// (confirmação, lembrete de consulta, retomada de abandono).
// =============================================================================

export const LEMBRETE_SYSTEM = `
Você redige e-mails curtos e humanos para pacientes de profissionais da saúde,
em português do Brasil. Tom gentil e claro. Máximo 3 frases no corpo. Devolva
SEMPRE no formato:
ASSUNTO: <linha de assunto>
CORPO: <texto do e-mail, sem assinatura formal>
`;

export function confirmacaoPrompt(o: {
  professionalName: string;
  leadName?: string;
  when: string;
  modality?: 'online' | 'presencial';
  meetingUrl?: string;
}): string {
  return `Escreva o e-mail de CONFIRMAÇÃO de consulta.
Profissional: ${o.professionalName}
Paciente: ${o.leadName ?? '(sem nome)'}
Quando: ${o.when}
Modalidade: ${o.modality ?? 'não informada'}${o.meetingUrl ? `\nLink: ${o.meetingUrl}` : ''}
Confirme o horário e diga que um lembrete chegará antes da consulta.`;
}

export function lembretePrompt(o: {
  professionalName: string;
  leadName?: string;
  when: string;
  modality?: 'online' | 'presencial';
  meetingUrl?: string;
}): string {
  return `Escreva o e-mail de LEMBRETE (a consulta é em breve).
Profissional: ${o.professionalName}
Paciente: ${o.leadName ?? '(sem nome)'}
Quando: ${o.when}
Modalidade: ${o.modality ?? 'não informada'}${o.meetingUrl ? `\nLink: ${o.meetingUrl}` : ''}
Lembre do horário e peça uma confirmação de presença.`;
}

export function retomadaPrompt(o: {
  professionalName: string;
  leadName?: string;
  lastTopic?: string;
}): string {
  return `Escreva um e-mail de RETOMADA para quem começou a triagem no site de
${o.professionalName} mas não concluiu o agendamento.
Paciente: ${o.leadName ?? '(sem nome)'}
O que buscava: ${o.lastTopic ?? 'não concluiu a triagem'}
Retome de forma leve, sem cobrança, e ofereça continuar de onde parou.`;
}
