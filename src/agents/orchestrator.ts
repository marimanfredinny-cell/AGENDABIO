// =============================================================================
// ORQUESTRADOR CENTRAL
//
// Padrão escolhido: orquestrador central com máquina de estados (state machine),
// NÃO agentes autônomos se chamando livremente. Motivos:
//   - Fluxo de negócio é linear e previsível: triagem -> captura -> agendamento.
//   - Cada agente é um especialista com prompt/tools próprios (baixo custo,
//     menos alucinação) em vez de um mega-prompt.
//   - O estado (`stage`) vive no banco (tabela conversation), então a jornada é
//     retomável e o follow-up de abandono sabe exatamente onde a pessoa parou.
//
// A cada mensagem do visitante, o orquestrador:
//   1. Carrega a conversa (histórico + stage) do Supabase.
//   2. Roteia para o agente do stage atual.
//   3. Se o agente sinalizar "done", persiste o resultado e AVANÇA o stage,
//      podendo já rodar o próximo agente na mesma requisição.
//   4. Devolve a próxima fala ao front-end e salva tudo.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase/server';
import type { ChatMessage, Conversation, Professional, Service } from '@/lib/types';
import { runTriageTurn, type TriageResult } from './triagem';
import { runLeadTurn, type LeadResult } from './lead';
import { runSchedulingTurn, type ScheduleResult } from './agendamento';
import { createEvent } from '@/lib/google/calendar';

export interface OrchestratorInput {
  conversationId: string;
  userMessage: string;
}

export interface OrchestratorOutput {
  reply: string;
  stage: Conversation['stage'];
  done: boolean; // true quando a jornada chegou a 'concluido'
}

function triageSummary(r: TriageResult): string {
  const linhas = r.respostas.map((a) => `- ${a.pergunta} ${a.resposta}`);
  return `Intenção: ${r.intent}${r.urgente ? ' (URGENTE)' : ''}\n${r.resumo}\n${linhas.join(
    '\n',
  )}`;
}

export async function handleMessage(
  input: OrchestratorInput,
): Promise<OrchestratorOutput> {
  const db = supabaseAdmin();

  // 1. Carrega conversa + profissional + serviços.
  const { data: conv } = await db
    .from('conversation')
    .select('*')
    .eq('id', input.conversationId)
    .single();
  if (!conv) throw new Error('Conversa não encontrada');

  const { data: prof } = await db
    .from('professional')
    .select('*')
    .eq('id', conv.professional_id)
    .single<Professional>();
  if (!prof) throw new Error('Profissional não encontrado');

  const { data: services } = await db
    .from('service')
    .select('*')
    .eq('professional_id', prof.id)
    .eq('is_active', true)
    .order('sort_order');

  // 2. Anexa a mensagem do usuário ao histórico.
  const history: ChatMessage[] = [
    ...(conv.messages as ChatMessage[]),
    { role: 'user', content: input.userMessage },
  ];

  let stage = conv.stage as Conversation['stage'];
  let reply = '';

  // 3. Máquina de estados. Um `while` permite encadear stages (ex.: terminar a
  //    triagem e já pedir os dados de contato na mesma resposta) — mas paramos
  //    assim que um agente devolve texto (precisa de input do visitante).
  let guard = 0;
  while (guard++ < 4) {
    if (stage === 'triagem') {
      const turn = await runTriageTurn(history, {
        professionalName: prof.display_name,
        specialty: prof.specialty ?? undefined,
        niche: prof.niche,
      });
      if (turn.done) {
        await persistTriage(conv.id, turn.done);
        await db
          .from('conversation')
          .update({ intent: turn.done.intent, stage: 'captura' })
          .eq('id', conv.id);
        stage = 'captura';
        // guarda o resumo no histórico como contexto interno
        history.push({
          role: 'assistant',
          content: `[triagem concluída] ${triageSummary(turn.done)}`,
        });
        continue; // encadeia para a captura
      }
      reply = turn.reply ?? '';
      break;
    }

    if (stage === 'captura') {
      const summary = lastTriageSummary(history);
      const turn = await runLeadTurn(history, {
        professionalName: prof.display_name,
        triageSummary: summary,
      });
      if (turn.done) {
        await persistLead(conv, turn.done, summary);
        const nextStage =
          conv.intent === 'agendar' ? 'agendamento' : 'concluido';
        await db
          .from('conversation')
          .update({ stage: nextStage })
          .eq('id', conv.id);
        stage = nextStage;
        if (nextStage === 'concluido') {
          reply =
            turn.reply ??
            'Prontinho! Registrei seu contato, em breve retornam pra você.';
          break;
        }
        continue; // vai para agendamento
      }
      reply = turn.reply ?? '';
      break;
    }

    if (stage === 'agendamento') {
      const turn = await runSchedulingTurn(history, {
        professionalId: prof.id,
        professionalName: prof.display_name,
        timezone: prof.timezone,
        services: (services ?? []) as Service[],
      });
      if (turn.done) {
        reply = await persistAppointment(conv, prof, turn.done);
        await db
          .from('conversation')
          .update({ stage: 'concluido' })
          .eq('id', conv.id);
        stage = 'concluido';
        break;
      }
      reply = turn.reply ?? '';
      break;
    }

    break; // concluido / abandonado
  }

  // 4. Persiste histórico atualizado.
  history.push({ role: 'assistant', content: reply });
  await db
    .from('conversation')
    .update({ messages: history, last_activity_at: new Date().toISOString() })
    .eq('id', conv.id);

  return { reply, stage, done: stage === 'concluido' };
}

// --- Persistência auxiliar -------------------------------------------------

async function persistTriage(conversationId: string, r: TriageResult) {
  const db = supabaseAdmin();
  const rows = r.respostas.map((a) => ({
    conversation_id: conversationId,
    question_key: a.chave,
    question_label: a.pergunta,
    answer: a.resposta,
  }));
  if (rows.length) await db.from('triage_answer').upsert(rows);
}

async function persistLead(
  conv: Conversation,
  lead: LeadResult,
  reason: string,
) {
  const db = supabaseAdmin();
  await db.from('lead').upsert(
    {
      professional_id: conv.professional_id,
      conversation_id: conv.id,
      full_name: lead.full_name,
      whatsapp: lead.whatsapp,
      email: lead.email ?? null,
      reason: lead.reason ?? reason,
      urgency: lead.urgency,
      recurrence: lead.recurrence,
      status: conv.intent === 'agendar' ? 'em_contato' : 'novo',
    },
    { onConflict: 'conversation_id' },
  );
}

async function persistAppointment(
  conv: Conversation,
  prof: Professional,
  sched: ScheduleResult,
): Promise<string> {
  const db = supabaseAdmin();
  const event = await createEvent(prof.id, {
    startsAt: sched.starts_at,
    endsAt: sched.ends_at,
    label: '',
  }, `Atendimento — ${prof.display_name}`);

  const { data: lead } = await db
    .from('lead')
    .select('id, whatsapp, full_name')
    .eq('conversation_id', conv.id)
    .maybeSingle();

  const { data: appt } = await db
    .from('appointment')
    .insert({
      professional_id: prof.id,
      lead_id: lead?.id ?? null,
      conversation_id: conv.id,
      service_id: sched.service_id,
      starts_at: sched.starts_at,
      ends_at: sched.ends_at,
      modality: sched.modality,
      gcal_event_id: event.gcalEventId,
      meeting_url: event.meetingUrl ?? null,
    })
    .select('id')
    .single();

  // Enfileira o lembrete: 24h antes da consulta.
  if (lead?.whatsapp && appt) {
    const remindAt = new Date(
      new Date(sched.starts_at).getTime() - 24 * 3600_000,
    );
    await db.from('notification').insert({
      professional_id: prof.id,
      lead_id: lead.id,
      appointment_id: appt.id,
      conversation_id: conv.id,
      kind: 'lembrete_consulta',
      channel: 'whatsapp',
      to_address: lead.whatsapp,
      body: '', // gerado pelo agente de follow-up no momento do envio
      scheduled_for: remindAt.toISOString(),
    });
    // Atualiza status do lead.
    await db.from('lead').update({ status: 'agendado' }).eq('id', lead.id);
  }

  const when = new Date(sched.starts_at).toLocaleString('pt-BR', {
    timeZone: prof.timezone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
  });
  return `Agendamento confirmado para ${when}. Você vai receber um lembrete no WhatsApp antes. Até lá! 💛`;
}

function lastTriageSummary(history: ChatMessage[]): string {
  const found = [...history]
    .reverse()
    .find((m) => m.content.startsWith('[triagem concluída]'));
  return found?.content.replace('[triagem concluída] ', '') ?? '';
}
