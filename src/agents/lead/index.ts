import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, AGENT_MODEL } from '@/lib/anthropic';
import type { ChatMessage, LeadInput } from '@/lib/store/types';

const salvarLeadTool: Anthropic.Tool = {
  name: 'salvar_lead',
  description: 'Registra o contato e a classificação. Chame quando tiver nome + telefone.',
  input_schema: {
    type: 'object',
    properties: {
      full_name: { type: 'string' },
      phone: { type: 'string', description: 'Com DDD' },
      email: { type: 'string', description: 'Opcional' },
      reason: { type: 'string' },
      urgency: { type: 'string', enum: ['urgente', 'nao_urgente'] },
      recurrence: { type: 'string', enum: ['primeira_vez', 'recorrente'] },
    },
    required: ['full_name', 'phone', 'urgency', 'recurrence'],
  },
};

function systemPrompt(professionalName: string, triageSummary: string): string {
  return `
Você é o assistente de ${professionalName} e agora registra o contato da pessoa
para dar sequência ao atendimento.

CONTEXTO DA TRIAGEM (já sabido — não pergunte de novo)
${triageSummary}

COLETE (uma pergunta por vez, natural)
  1. Nome
  2. Telefone (com DDD) — vamos usar para retorno e para enviar confirmação/lembrete
  3. E-mail (o lembrete e a confirmação vão por e-mail — peça com atenção)
Explique o porquê ("pra ${professionalName} te dar retorno e enviar a confirmação").
Não peça CPF nem dados sensíveis.

CLASSIFIQUE (com base na triagem):
  urgency: "urgente" se há sofrimento agudo/prazo curto; senão "nao_urgente".
  recurrence: "primeira_vez" ou "recorrente".

Quando tiver nome + telefone + e-mail, chame "salvar_lead". Depois, se a intenção
era agendar, avise que vai ajudar a marcar e encerre. Não continue conversando.
`;
}

export interface LeadTurn {
  reply?: string;
  done?: LeadInput;
}

export async function runLeadTurn(
  history: ChatMessage[],
  ctx: { professionalName: string; triageSummary: string },
): Promise<LeadTurn> {
  const response = await anthropic.messages.create({
    model: AGENT_MODEL,
    max_tokens: 1024,
    system: systemPrompt(ctx.professionalName, ctx.triageSummary),
    tools: [salvarLeadTool],
    messages: history,
  });
  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (toolUse && toolUse.type === 'tool_use') {
    return { done: toolUse.input as LeadInput };
  }
  const text = response.content.find((b) => b.type === 'text');
  return { reply: text && text.type === 'text' ? text.text : '' };
}
