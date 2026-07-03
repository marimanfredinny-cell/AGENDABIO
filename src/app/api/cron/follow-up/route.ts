import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { anthropic, AGENT_MODEL } from '@/lib/anthropic';
import { sendWhatsApp } from '@/lib/twilio/whatsapp';
import {
  FOLLOWUP_SYSTEM,
  reminderUserPrompt,
  abandonUserPrompt,
} from '@/agents/followup/prompt';

export const runtime = 'nodejs';

// GET /api/cron/follow-up
// Acionado por um cron (Vercel Cron, Supabase pg_cron ou Cloud Scheduler).
// Faz DUAS coisas:
//   1. Enfileira retomadas de conversas abandonadas (>2h paradas na triagem/captura).
//   2. Envia as notificações pendentes cujo horário já chegou (lembretes + retomadas).
//
// Protegido por header 'x-cron-secret' == CRON_SECRET.
export async function GET(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const db = supabaseAdmin();
  const now = new Date();

  // ---- 1. Detecta abandono e enfileira retomada -----------------------------
  const abandonCutoff = new Date(now.getTime() - 2 * 3600_000).toISOString();
  const { data: stalled } = await db
    .from('conversation')
    .select('id, professional_id, intent, stage, last_activity_at')
    .in('stage', ['triagem', 'captura'])
    .lt('last_activity_at', abandonCutoff)
    .limit(20);

  for (const conv of stalled ?? []) {
    // Já existe lead com WhatsApp? Só dá pra retomar se tivermos como contatar.
    const { data: lead } = await db
      .from('lead')
      .select('id, whatsapp, full_name')
      .eq('conversation_id', conv.id)
      .maybeSingle();
    if (!lead?.whatsapp) continue;

    // Evita duplicar retomada.
    const { data: existing } = await db
      .from('notification')
      .select('id')
      .eq('conversation_id', conv.id)
      .eq('kind', 'retomada_abandono')
      .maybeSingle();
    if (existing) continue;

    const { data: prof } = await db
      .from('professional')
      .select('display_name')
      .eq('id', conv.professional_id)
      .single();

    await db.from('notification').insert({
      professional_id: conv.professional_id,
      lead_id: lead.id,
      conversation_id: conv.id,
      kind: 'retomada_abandono',
      channel: 'whatsapp',
      to_address: lead.whatsapp,
      body: '', // gerado abaixo no envio
      scheduled_for: now.toISOString(),
    });
    // marca a conversa como abandonada para não reprocessar
    await db.from('conversation').update({ stage: 'abandonado' }).eq('id', conv.id);
    void prof;
  }

  // ---- 2. Envia notificações vencidas ---------------------------------------
  const { data: due } = await db
    .from('notification')
    .select('*')
    .eq('status', 'pendente')
    .lte('scheduled_for', now.toISOString())
    .limit(50);

  let sent = 0;
  for (const n of due ?? []) {
    try {
      const body = n.body?.trim() || (await generateBody(n));
      const res = await sendWhatsApp(n.to_address, body, undefined);
      await db
        .from('notification')
        .update({
          status: 'enviado',
          body,
          provider_message_id: res.providerMessageId,
          sent_at: new Date().toISOString(),
        })
        .eq('id', n.id);
      sent++;
    } catch (err) {
      await db
        .from('notification')
        .update({ status: 'falhou', error: String(err) })
        .eq('id', n.id);
    }
  }

  return NextResponse.json({
    abandonEnqueued: stalled?.length ?? 0,
    sent,
  });
}

// Gera o texto da mensagem usando o Agente de Follow-up (Claude).
async function generateBody(n: any): Promise<string> {
  const db = supabaseAdmin();
  const { data: prof } = await db
    .from('professional')
    .select('display_name')
    .eq('id', n.professional_id)
    .single();
  const { data: lead } = n.lead_id
    ? await db.from('lead').select('full_name').eq('id', n.lead_id).single()
    : { data: null };

  let userPrompt: string;
  if (n.kind === 'lembrete_consulta' && n.appointment_id) {
    const { data: appt } = await db
      .from('appointment')
      .select('starts_at, modality, meeting_url')
      .eq('id', n.appointment_id)
      .single();
    const when = new Date(appt!.starts_at).toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
    });
    userPrompt = reminderUserPrompt({
      professionalName: prof!.display_name,
      leadName: lead?.full_name,
      when,
      modality: appt!.modality,
      meetingUrl: appt!.meeting_url ?? undefined,
    });
  } else {
    userPrompt = abandonUserPrompt({
      professionalName: prof!.display_name,
      leadName: lead?.full_name,
    });
  }

  const resp = await anthropic.messages.create({
    model: AGENT_MODEL,
    max_tokens: 300,
    system: FOLLOWUP_SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const text = resp.content.find((b) => b.type === 'text');
  return text && text.type === 'text' ? text.text.trim() : 'Olá! Podemos continuar?';
}
