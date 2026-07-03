import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, AGENT_MODEL } from '@/lib/anthropic';
import type { ChatMessage } from '@/lib/types';
import { buildLeadCapturePrompt } from './prompt';

export const salvarLeadTool: Anthropic.Tool = {
  name: 'salvar_lead',
  description:
    'Registra os dados de contato e a classificação do lead. Chame quando ' +
    'tiver ao menos nome e WhatsApp.',
  input_schema: {
    type: 'object',
    properties: {
      full_name: { type: 'string' },
      whatsapp: { type: 'string', description: 'Com DDD, ex: (11) 99999-9999' },
      email: { type: 'string', description: 'Opcional' },
      reason: { type: 'string', description: 'Motivo do contato' },
      urgency: { type: 'string', enum: ['urgente', 'nao_urgente'] },
      recurrence: { type: 'string', enum: ['primeira_vez', 'recorrente'] },
    },
    required: ['full_name', 'whatsapp', 'urgency', 'recurrence'],
  },
};

export interface LeadResult {
  full_name: string;
  whatsapp: string;
  email?: string;
  reason?: string;
  urgency: 'urgente' | 'nao_urgente';
  recurrence: 'primeira_vez' | 'recorrente';
}

export interface LeadTurn {
  reply?: string;
  done?: LeadResult;
}

export async function runLeadTurn(
  history: ChatMessage[],
  ctx: { professionalName: string; triageSummary: string },
): Promise<LeadTurn> {
  const response = await anthropic.messages.create({
    model: AGENT_MODEL,
    max_tokens: 1024,
    system: buildLeadCapturePrompt(ctx),
    tools: [salvarLeadTool],
    messages: history,
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (toolUse && toolUse.type === 'tool_use') {
    return { done: toolUse.input as LeadResult };
  }
  const text = response.content.find((b) => b.type === 'text');
  return { reply: text && text.type === 'text' ? text.text : '' };
}
