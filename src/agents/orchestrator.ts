// =============================================================================
// ORQUESTRADOR CENTRAL — máquina de estados que costura os 4 agentes.
//
// Padrão: orquestrador central (não agentes autônomos). O estado (`stage`) vive
// na tabela `conversation`, então a jornada é retomável e o lembrete de abandono
// sabe onde a pessoa parou. Os agentes não conversam entre si — o handoff é o
// estado compartilhado no banco (resumo da triagem, intent, lead).
//
// Duas trilhas:
//   - COM ANTHROPIC_API_KEY: agentes reais (Claude + tool use).
//   - SEM chave (modo demo): motor determinístico que percorre o template.
// =============================================================================

import { USE_CLAUDE } from '@/lib/config';
import { store } from '@/lib/store';
import type { ChatMessage, Conversation, PublicProfile, Stage } from '@/lib/store/types';
import { runTriageTurn, type TriageResult } from './triagem';
import { runLeadTurn } from './lead';
import { runSchedulingTurn } from './agendamento';
import { createEvent } from '@/lib/google/calendar';
import { demoStep } from '@/lib/demo/engine';

export interface OrchestratorOutput {
  reply: string;
  stage: Stage;
  done: boolean;
}

const TRIAGE_TAG = '[triagem]';

export async function handleMessage(
  conversationId: string,
  userMessage: string,
): Promise<OrchestratorOutput> {
  const conv = await store.getConversation(conversationId);
  if (!conv) throw new Error('Conversa não encontrada');
  const profile = await store.getPublicProfileById(conv.professional_id);
  if (!profile) throw new Error('Profissional não encontrado');

  // ---- Trilha DEMO -------------------------------------------------------
  if (!USE_CLAUDE) {
    const step = await demoStep(store, profile, conv, userMessage);
    const messages: ChatMessage[] = [
      ...conv.messages,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: step.reply },
    ];
    await store.updateConversation(conv.id, {
      stage: step.stage,
      intent: step.intent ?? conv.intent,
      messages,
    });
    return { reply: step.reply, stage: step.stage, done: step.done };
  }

  // ---- Trilha CLAUDE -----------------------------------------------------
  const history: ChatMessage[] = [
    ...conv.messages,
    { role: 'user', content: userMessage },
  ];
  let stage = conv.stage;
  let intent = conv.intent;
  let reply = '';
  let guard = 0;

  while (guard++ < 4) {
    if (stage === 'triagem') {
      const turn = await runTriageTurn(history, {
        professionalName: profile.professional.display_name,
        specialtyLabel: profile.specialty.label,
        personaNote: profile.template.persona_note,
        questions: profile.template.questions,
      });
      if (turn.done) {
        await store.saveTriageAnswers(conv.id, turn.done.respostas);
        intent = turn.done.intent;
        stage = 'captura';
        history.push({
          role: 'assistant',
          content: `${TRIAGE_TAG} ${summary(turn.done)}`,
        });
        continue;
      }
      reply = turn.reply ?? '';
      break;
    }

    if (stage === 'captura') {
      const triageSummary = lastTag(history);
      const turn = await runLeadTurn(history, {
        professionalName: profile.professional.display_name,
        triageSummary,
      });
      if (turn.done) {
        await store.upsertLead(profile.professional.id, conv.id, {
          ...turn.done,
          reason: turn.done.reason ?? triageSummary,
        });
        stage = intent === 'agendar' ? 'agendamento' : 'concluido';
        if (stage === 'concluido') {
          reply = turn.reply ?? 'Prontinho! Registrei seu contato, em breve retornam.';
          break;
        }
        continue;
      }
      reply = turn.reply ?? '';
      break;
    }

    if (stage === 'agendamento') {
      const turn = await runSchedulingTurn(history, {
        professionalId: profile.professional.id,
        professionalName: profile.professional.display_name,
        timezone: profile.professional.timezone,
        services: profile.services,
      });
      if (turn.done) {
        reply = await finalizeAppointment(profile, conv, turn.done);
        stage = 'concluido';
        break;
      }
      reply = turn.reply ?? '';
      break;
    }
    break;
  }

  history.push({ role: 'assistant', content: reply });
  await store.updateConversation(conv.id, { stage, intent, messages: history });
  return { reply, stage, done: stage === 'concluido' };
}

function summary(r: TriageResult): string {
  const linhas = r.respostas.map((a) => `- ${a.label} ${a.answer}`);
  return `Intenção: ${r.intent}${r.urgente ? ' (URGENTE)' : ''}\n${r.resumo}\n${linhas.join('\n')}`;
}

function lastTag(history: ChatMessage[]): string {
  const found = [...history].reverse().find((m) => m.content.startsWith(TRIAGE_TAG));
  return found?.content.replace(`${TRIAGE_TAG} `, '') ?? '';
}

async function finalizeAppointment(
  profile: PublicProfile,
  conv: Conversation,
  appt: { service_id: string; starts_at: string; ends_at: string; modality: 'online' | 'presencial' },
): Promise<string> {
  const attendeeEmail = await store.getLeadEmail(conv.id);
  const event = await createEvent({
    professionalId: profile.professional.id,
    timezone: profile.professional.timezone,
    slot: { startsAt: appt.starts_at, endsAt: appt.ends_at, label: '' },
    summary: `Consulta — ${profile.professional.display_name}`,
    attendeeEmail,
    modality: appt.modality,
  });
  const created = await store.createAppointment(profile.professional.id, conv.id, {
    ...appt,
    gcal_event_id: event.gcalEventId,
    meeting_url: event.meetingUrl,
  });

  const when = new Date(appt.starts_at).toLocaleString('pt-BR', {
    timeZone: profile.professional.timezone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
  });

  // Enfileira confirmação (imediata) + lembrete (24h antes) por e-mail.
  const to = attendeeEmail ?? profile.professional.reply_to_email ?? '';
  if (to) {
    await store.enqueueNotification({
      professionalId: profile.professional.id,
      conversationId: conv.id,
      appointmentId: created.id,
      kind: 'confirmacao',
      to,
      subject: `Consulta confirmada — ${profile.professional.display_name}`,
      body: `Consulta confirmada para ${when}.`,
      scheduledFor: new Date().toISOString(),
    });
    await store.enqueueNotification({
      professionalId: profile.professional.id,
      conversationId: conv.id,
      appointmentId: created.id,
      kind: 'lembrete_consulta',
      to,
      scheduledFor: new Date(Date.parse(appt.starts_at) - 24 * 3600_000).toISOString(),
    });
  }

  return `Agendamento confirmado para ${when}. A confirmação e o lembrete chegam por e-mail. Até lá! 💛`;
}
