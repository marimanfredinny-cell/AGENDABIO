// =============================================================================
// AGENTE DE FOLLOW-UP / LEMBRETE — geração de mensagens
//
// Este agente NÃO é conversacional em tempo real: ele é acionado por um cron/
// worker (src/app/api/cron/follow-up) para PRODUZIR o texto da mensagem de
// WhatsApp que será enfileirada na tabela `notification`.
//
// Dois casos de uso:
//   - lembrete_consulta  : X horas antes do horário marcado.
//   - retomada_abandono  : conversa iniciou triagem mas não concluiu em X horas.
// =============================================================================

export interface ReminderContext {
  professionalName: string;
  leadName?: string;
  when: string; // "quinta, 12/07 às 9h"
  modality?: 'online' | 'presencial';
  meetingUrl?: string;
}

export interface AbandonContext {
  professionalName: string;
  leadName?: string;
  intent?: 'agendar' | 'duvida' | 'orcamento' | 'indefinido';
  lastTopic?: string; // resumo do que a pessoa buscava
}

export const FOLLOWUP_SYSTEM = `
Você redige mensagens curtas de WhatsApp para profissionais liberais. Tom:
humano, gentil, direto, português do Brasil, no máximo 2 frases. Sem emojis em
excesso (no máximo 1). Nunca soe como robô nem como spam. Uma única mensagem,
pronta para enviar — sem aspas, sem assinatura formal.
`;

export function reminderUserPrompt(ctx: ReminderContext): string {
  return `Escreva um LEMBRETE de consulta.
Profissional: ${ctx.professionalName}
Paciente/cliente: ${ctx.leadName ?? '(sem nome)'}
Quando: ${ctx.when}
Modalidade: ${ctx.modality ?? 'não informada'}${
    ctx.meetingUrl ? `\nLink da consulta: ${ctx.meetingUrl}` : ''
  }
A mensagem deve confirmar o horário e pedir uma resposta rápida de confirmação
(ex.: "pode confirmar?"). Se for online e houver link, inclua o link.`;
}

export function abandonUserPrompt(ctx: AbandonContext): string {
  return `Escreva uma mensagem de RETOMADA para alguém que começou a conversa no
link de ${ctx.professionalName} mas não concluiu.
Nome: ${ctx.leadName ?? '(sem nome)'}
O que buscava: ${ctx.lastTopic ?? 'não concluiu a triagem'}
Intenção detectada: ${ctx.intent ?? 'indefinida'}
A mensagem deve retomar de forma leve, sem cobrança, e oferecer ajuda para
continuar de onde parou (ex.: agendar/tirar a dúvida).`;
}
