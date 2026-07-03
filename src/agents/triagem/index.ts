import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, AGENT_MODEL } from '@/lib/anthropic';
import type { ChatMessage, Intent, Niche } from '@/lib/types';
import { buildTriagePrompt } from './prompt';

// Ferramenta que o Agente de Triagem chama quando terminou de qualificar.
// A saída estruturada aqui alimenta o Agente de Captura e o de Agendamento.
export const registrarTriagemTool: Anthropic.Tool = {
  name: 'registrar_triagem',
  description:
    'Registra o resultado da triagem quando você já entendeu a intenção da ' +
    'pessoa e coletou as respostas do nicho. Chame apenas ao final.',
  input_schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['agendar', 'duvida', 'orcamento', 'indefinido'],
        description: 'O que a pessoa quer fazer.',
      },
      urgente: {
        type: 'boolean',
        description: 'True se houver prazo curto, sofrimento agudo ou risco.',
      },
      resumo: {
        type: 'string',
        description: 'Resumo em 1-2 frases do motivo do contato.',
      },
      respostas: {
        type: 'array',
        description: 'Respostas estruturadas do nicho.',
        items: {
          type: 'object',
          properties: {
            chave: { type: 'string', description: 'ex: ja_fez_terapia' },
            pergunta: { type: 'string' },
            resposta: { type: 'string' },
          },
          required: ['chave', 'pergunta', 'resposta'],
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
  respostas: Array<{ chave: string; pergunta: string; resposta: string }>;
}

export interface TriageTurn {
  // Resposta em texto para mostrar ao visitante (quando ainda perguntando).
  reply?: string;
  // Preenchido quando a triagem terminou (tool foi chamada).
  done?: TriageResult;
}

/**
 * Processa um turno da triagem. Recebe o histórico e devolve a próxima
 * fala do agente OU o resultado estruturado quando a triagem termina.
 */
export async function runTriageTurn(
  history: ChatMessage[],
  ctx: { professionalName: string; specialty?: string; niche: Niche },
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
