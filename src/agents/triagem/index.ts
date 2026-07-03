import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, AGENT_MODEL } from '@/lib/anthropic';
import type { ChatMessage, Intent, TriageQuestion } from '@/lib/store/types';
import { buildTriagePrompt } from './prompt';

export const registrarTriagemTool: Anthropic.Tool = {
  name: 'registrar_triagem',
  description:
    'Registra o resultado da triagem quando você já entendeu a intenção e ' +
    'coletou as respostas das perguntas. Chame apenas ao final.',
  input_schema: {
    type: 'object',
    properties: {
      intent: { type: 'string', enum: ['agendar', 'duvida', 'informacao', 'indefinido'] },
      urgente: { type: 'boolean' },
      resumo: { type: 'string', description: 'Motivo do contato em 1-2 frases.' },
      respostas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'A key exata da pergunta do template.' },
            label: { type: 'string' },
            answer: { type: 'string' },
          },
          required: ['key', 'label', 'answer'],
        },
      },
    },
    required: ['intent', 'urgente', 'resumo', 'respostas'],
  },
};

export interface TriageResult {
  intent: Intent;
  urgente: boolean;
  resumo: string;
  respostas: Array<{ key: string; label: string; answer: string }>;
}

export interface TriageTurn {
  reply?: string;
  done?: TriageResult;
}

export async function runTriageTurn(
  history: ChatMessage[],
  ctx: {
    professionalName: string;
    specialtyLabel: string;
    personaNote?: string | null;
    questions: TriageQuestion[];
  },
): Promise<TriageTurn> {
  const response = await anthropic.messages.create({
    model: AGENT_MODEL,
    max_tokens: 1024,
    system: buildTriagePrompt(ctx),
    tools: [registrarTriagemTool],
    messages: history,
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (toolUse && toolUse.type === 'tool_use') {
    return { done: toolUse.input as TriageResult };
  }
  const text = response.content.find((b) => b.type === 'text');
  return { reply: text && text.type === 'text' ? text.text : '' };
}
