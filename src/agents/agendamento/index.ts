import type Anthropic from '@anthropic-ai/sdk';
import { anthropic, AGENT_MODEL } from '@/lib/anthropic';
import type { AppointmentInput, ChatMessage, Service } from '@/lib/store/types';
import { getAvailability, type Slot } from '@/lib/google/calendar';

const consultarDisponibilidadeTool: Anthropic.Tool = {
  name: 'consultar_disponibilidade',
  description: 'Busca os próximos horários livres reais na agenda.',
  input_schema: {
    type: 'object',
    properties: { service_id: { type: 'string' } },
    required: ['service_id'],
  },
};

const confirmarAgendamentoTool: Anthropic.Tool = {
  name: 'confirmar_agendamento',
  description: 'Confirma o agendamento após a pessoa escolher e confirmar data/hora.',
  input_schema: {
    type: 'object',
    properties: {
      service_id: { type: 'string' },
      starts_at: { type: 'string' },
      ends_at: { type: 'string' },
      modality: { type: 'string', enum: ['online', 'presencial'] },
    },
    required: ['service_id', 'starts_at', 'ends_at', 'modality'],
  },
};

function systemPrompt(professionalName: string, tz: string, services: Service[]): string {
  const menu = services
    .map((s) => `  - ${s.name} (${s.modality}, ${s.duration_minutes}min) [id: ${s.id}]`)
    .join('\n');
  return `
Você é o assistente de agendamento de ${professionalName}. A pessoa passou pela
triagem e QUER marcar. Conduza rápido e sem fricção. Fuso: ${tz}.

TIPOS DE ATENDIMENTO
${menu}

FLUXO
1. Confirme o tipo (primeira/retorno, online/presencial). Se a triagem já deixou
   claro, apenas confirme em uma frase.
2. Use "consultar_disponibilidade" para buscar horários REAIS. Nunca invente.
3. Ofereça 2–3 opções por vez de forma simpática.
4. Ao escolher, use "confirmar_agendamento" com o horário e service_id.
5. Depois, avise que a confirmação e o lembrete chegam por e-mail e encerre.

Uma pergunta por vez, mensagens curtas, sempre confirme data+dia+hora antes de fechar.
`;
}

export interface ScheduleTurn {
  reply?: string;
  done?: AppointmentInput;
}

export async function runSchedulingTurn(
  history: ChatMessage[],
  ctx: { professionalId: string; professionalName: string; timezone: string; services: Service[] },
): Promise<ScheduleTurn> {
  const system = systemPrompt(ctx.professionalName, ctx.timezone, ctx.services);
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
      return { done: toolUse.input as AppointmentInput };
    }

    // consultar_disponibilidade -> resolve e devolve ao modelo
    const input = toolUse.input as { service_id: string };
    const service = ctx.services.find((s) => s.id === input.service_id);
    const slots: Slot[] = await getAvailability({
      professionalId: ctx.professionalId,
      timezone: ctx.timezone,
      durationMinutes: service?.duration_minutes ?? 50,
    });
    msgs.push({ role: 'assistant', content: response.content });
    msgs.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(slots) }],
    });
  }
  return { reply: 'Deixa eu confirmar os horários e já te retorno.' };
}
