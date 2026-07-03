import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, AGENT_MODEL } from '@/lib/anthropic';
import type { ChatMessage, Service } from '@/lib/types';
import { getAvailability, type Slot } from '@/lib/google/calendar';
import { buildSchedulingPrompt } from './prompt';

const consultarDisponibilidadeTool: Anthropic.Tool = {
  name: 'consultar_disponibilidade',
  description: 'Busca os próximos horários livres reais na agenda.',
  input_schema: {
    type: 'object',
    properties: {
      service_id: { type: 'string' },
    },
    required: ['service_id'],
  },
};

const confirmarAgendamentoTool: Anthropic.Tool = {
  name: 'confirmar_agendamento',
  description:
    'Confirma o agendamento no horário escolhido. Chame só depois que a ' +
    'pessoa confirmar data e hora.',
  input_schema: {
    type: 'object',
    properties: {
      service_id: { type: 'string' },
      starts_at: { type: 'string', description: 'ISO 8601 do slot escolhido' },
      ends_at: { type: 'string' },
      modality: { type: 'string', enum: ['online', 'presencial'] },
    },
    required: ['service_id', 'starts_at', 'ends_at', 'modality'],
  },
};

export interface ScheduleResult {
  service_id: string;
  starts_at: string;
  ends_at: string;
  modality: 'online' | 'presencial';
}

export interface ScheduleTurn {
  reply?: string;
  done?: ScheduleResult;
}

/**
 * Um turno do agendamento. Trata o loop de tool use: se o modelo pedir
 * disponibilidade, busca e devolve o resultado ao modelo na mesma rodada.
 */
export async function runSchedulingTurn(
  history: ChatMessage[],
  ctx: {
    professionalId: string;
    professionalName: string;
    timezone: string;
    services: Service[];
  },
): Promise<ScheduleTurn> {
  const system = buildSchedulingPrompt({
    professionalName: ctx.professionalName,
    timezone: ctx.timezone,
    services: ctx.services.map((s) => ({
      id: s.id,
      name: s.name,
      modality: s.modality,
      durationMinutes: s.duration_minutes,
    })),
  });

  // Loop da API da Claude: resolvemos tools server-side até sair um texto ou
  // a confirmação final.
  const msgs: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (let i = 0; i < 4; i++) {
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1024,
      system,
      tools: [consultarDisponibilidadeTool, confirmarAgendamentoTool],
      messages: msgs,
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use');

    if (!toolUse || toolUse.type !== 'tool_use') {
      const text = response.content.find((b) => b.type === 'text');
      return { reply: text && text.type === 'text' ? text.text : '' };
    }

    if (toolUse.name === 'confirmar_agendamento') {
      return { done: toolUse.input as ScheduleResult };
    }

    if (toolUse.name === 'consultar_disponibilidade') {
      const input = toolUse.input as { service_id: string };
      const service = ctx.services.find((s) => s.id === input.service_id);
      const slots: Slot[] = await getAvailability(
        ctx.professionalId,
        service?.duration_minutes ?? 50,
      );
      // Devolve o resultado da tool ao modelo e continua o loop.
      msgs.push({ role: 'assistant', content: response.content });
      msgs.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(slots),
          },
        ],
      });
    }
  }

  return { reply: 'Deixa eu confirmar os horários e já te retorno.' };
}
