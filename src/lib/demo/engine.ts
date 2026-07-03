// =============================================================================
// MOTOR DO MODO DEMO (sem LLM, sem banco externo).
// Percorre as perguntas do triage_template da especialidade e simula todo o
// fluxo: triagem -> captura -> agendamento -> confirmação por e-mail (logada).
// Usado só quando não há ANTHROPIC_API_KEY. Prova o conceito e a UX.
// =============================================================================

import type { Store } from '@/lib/store';
import type {
  Conversation,
  Intent,
  PublicProfile,
  Stage,
} from '@/lib/store/types';
import { getAvailability, type Slot } from '@/lib/google/calendar';

interface Progress {
  qIndex: number; // próxima pergunta de triagem a responder
  answers: Array<{ key: string; label: string; answer: string }>;
  capStep?: 'name' | 'phone' | 'email';
  cap: { name?: string; phone?: string; email?: string };
  slots?: Slot[];
}

const state = new Map<string, Progress>();

export function demoGreeting(p: PublicProfile): string {
  const q0 = p.template.questions[0];
  const opts =
    q0?.kind === 'choice' && q0.options?.length
      ? ` (${q0.options.join(' / ')})`
      : '';
  return (
    `Oi! Sou o concierge de ${p.professional.display_name} ` +
    `(${p.specialty.label}). Vou te fazer algumas perguntas rápidas pra entender ` +
    `como ajudar melhor. Pra começar: ${q0?.label}${opts}`
  );
}

export interface DemoStep {
  reply: string;
  stage: Stage;
  intent?: Intent;
  done: boolean;
}

export async function demoStep(
  store: Store,
  profile: PublicProfile,
  conv: Conversation,
  userMessage: string,
): Promise<DemoStep> {
  const prog = state.get(conv.id) ?? { qIndex: 0, answers: [], cap: {} };
  const q = profile.template.questions;

  // ---- TRIAGEM -------------------------------------------------------------
  if (conv.stage === 'triagem') {
    // registra resposta da pergunta atual
    const current = q[prog.qIndex];
    if (current) {
      prog.answers.push({ key: current.key, label: current.label, answer: userMessage });
    }
    prog.qIndex += 1;

    if (prog.qIndex < q.length) {
      const next = q[prog.qIndex];
      const opts =
        next.kind === 'choice' && next.options?.length
          ? ` (${next.options.join(' / ')})`
          : '';
      state.set(conv.id, prog);
      return { reply: `${next.label}${opts}`, stage: 'triagem', done: false };
    }

    // triagem concluída -> salva respostas, vai para captura
    await store.saveTriageAnswers(conv.id, prog.answers);
    prog.capStep = 'name';
    state.set(conv.id, prog);
    return {
      reply:
        'Perfeito, já entendi bem sua necessidade 🙂 Pra dar sequência e ' +
        'reservar seu horário, como é seu nome?',
      stage: 'captura',
      intent: 'agendar',
      done: false,
    };
  }

  // ---- CAPTURA -------------------------------------------------------------
  if (conv.stage === 'captura') {
    if (prog.capStep === 'name') {
      prog.cap.name = userMessage.trim();
      prog.capStep = 'phone';
      state.set(conv.id, prog);
      return {
        reply: `Prazer, ${prog.cap.name.split(' ')[0]}! Qual seu telefone com DDD?`,
        stage: 'captura',
        done: false,
      };
    }
    if (prog.capStep === 'phone') {
      prog.cap.phone = userMessage.trim();
      prog.capStep = 'email';
      state.set(conv.id, prog);
      return {
        reply: 'Anotado. E qual seu melhor e-mail? (a confirmação e o lembrete vão por e-mail)',
        stage: 'captura',
        done: false,
      };
    }
    // email -> salva lead e vai para agendamento
    prog.cap.email = userMessage.trim();
    const reason = prog.answers.map((a) => `${a.label} ${a.answer}`).join(' | ');
    await store.upsertLead(profile.professional.id, conv.id, {
      full_name: prog.cap.name ?? '',
      phone: prog.cap.phone ?? '',
      email: prog.cap.email,
      reason,
      urgency: 'nao_urgente',
      recurrence: 'primeira_vez',
    });

    const slots = await getAvailability({
      professionalId: profile.professional.id,
      timezone: profile.professional.timezone,
      durationMinutes: profile.services[0]?.duration_minutes ?? 50,
    });
    prog.slots = slots;
    state.set(conv.id, prog);
    const lista = slots.map((s, i) => `${i + 1}) ${s.label}`).join('\n');
    return {
      reply: `Show! Tenho estes horários pra ${profile.services[0]?.name ?? 'consulta'}:\n${lista}\n\nQual fica melhor? (responda o número)`,
      stage: 'agendamento',
      done: false,
    };
  }

  // ---- AGENDAMENTO ---------------------------------------------------------
  if (conv.stage === 'agendamento') {
    const slots =
      prog.slots ??
      (await getAvailability({
        professionalId: profile.professional.id,
        timezone: profile.professional.timezone,
        durationMinutes: profile.services[0]?.duration_minutes ?? 50,
      }));
    const n = parseInt(userMessage.trim(), 10);
    const chosen = !Number.isNaN(n) && slots[n - 1] ? slots[n - 1] : slots[0];

    const appt = await store.createAppointment(profile.professional.id, conv.id, {
      service_id: profile.services[0]?.id ?? 'svc',
      starts_at: chosen.startsAt,
      ends_at: chosen.endsAt,
      modality: 'online',
    });

    // confirmação imediata + lembrete 24h antes (fila de e-mail)
    if (prog.cap.email) {
      await store.enqueueNotification({
        professionalId: profile.professional.id,
        conversationId: conv.id,
        appointmentId: appt.id,
        kind: 'confirmacao',
        to: prog.cap.email,
        subject: `Consulta confirmada — ${profile.professional.display_name}`,
        body: `Sua consulta está confirmada para ${chosen.label}.`,
        scheduledFor: new Date().toISOString(),
      });
      await store.enqueueNotification({
        professionalId: profile.professional.id,
        conversationId: conv.id,
        appointmentId: appt.id,
        kind: 'lembrete_consulta',
        to: prog.cap.email,
        scheduledFor: new Date(Date.parse(chosen.startsAt) - 24 * 3600_000).toISOString(),
      });
    }

    state.delete(conv.id);
    return {
      reply:
        `Prontinho! Sua consulta está confirmada para ${chosen.label}. ` +
        `Enviei a confirmação para ${prog.cap.email} e você recebe um lembrete ` +
        `por e-mail antes. Até lá! 💛`,
      stage: 'concluido',
      done: true,
    };
  }

  return { reply: 'Sua solicitação já foi concluída. Obrigado!', stage: 'concluido', done: true };
}
