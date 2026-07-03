import { NextRequest, NextResponse } from 'next/server';
import { USE_SUPABASE, USE_CLAUDE } from '@/lib/config';
import { sendEmail } from '@/lib/email/resend';

export const runtime = 'nodejs';

// GET /api/cron/reminders  (protegido por header x-cron-secret == CRON_SECRET)
// 1) Detecta conversas abandonadas e enfileira retomada.
// 2) Envia as notificações (e-mail) vencidas.
// Só roda com Supabase (a fila vive no banco). No modo demo os e-mails são
// logados no momento do agendamento.
export async function GET(req: NextRequest) {
  if (req.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  if (!USE_SUPABASE) {
    return NextResponse.json({ skipped: 'modo demo — sem fila persistente' });
  }

  // Import tardio para não exigir Supabase no modo demo.
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const now = new Date();

  // ---- 1. Retomada de abandono (>2h parado na triagem/captura) -------------
  const cutoff = new Date(now.getTime() - 2 * 3600_000).toISOString();
  const { data: stalled } = await db
    .from('conversation')
    .select('id, professional_id')
    .in('stage', ['triagem', 'captura'])
    .lt('last_activity_at', cutoff)
    .limit(20);

  for (const c of stalled ?? []) {
    const { data: lead } = await db
      .from('lead')
      .select('id, email, full_name')
      .eq('conversation_id', c.id)
      .maybeSingle();
    if (!lead?.email) continue;
    const { data: dup } = await db
      .from('notification')
      .select('id')
      .eq('conversation_id', c.id)
      .eq('kind', 'retomada_abandono')
      .maybeSingle();
    if (dup) continue;
    await db.from('notification').insert({
      professional_id: c.professional_id,
      lead_id: lead.id,
      conversation_id: c.id,
      kind: 'retomada_abandono',
      channel: 'email',
      to_address: lead.email,
      scheduled_for: now.toISOString(),
    });
    await db.from('conversation').update({ stage: 'abandonado' }).eq('id', c.id);
  }

  // ---- 2. Envia e-mails vencidos ------------------------------------------
  const { data: due } = await db
    .from('notification')
    .select('*')
    .eq('status', 'pendente')
    .lte('scheduled_for', now.toISOString())
    .limit(50);

  let sent = 0;
  for (const n of due ?? []) {
    try {
      const { subject, body } = await ensureCopy(db, n);
      const res = await sendEmail({ to: n.to_address, subject, body });
      await db
        .from('notification')
        .update({
          status: 'enviado',
          subject,
          body,
          provider_message_id: res.id,
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

  return NextResponse.json({ abandonEnqueued: stalled?.length ?? 0, sent });
}

// Garante assunto+corpo. Se vazios, gera com o Agente de Lembrete (Claude).
async function ensureCopy(db: any, n: any): Promise<{ subject: string; body: string }> {
  if (n.subject && n.body) return { subject: n.subject, body: n.body };
  if (!USE_CLAUDE) {
    return {
      subject: n.subject ?? 'Sobre sua consulta',
      body: n.body ?? 'Olá! Passando para falar sobre sua consulta.',
    };
  }
  const { anthropic, AGENT_MODEL } = await import('@/lib/anthropic');
  const { LEMBRETE_SYSTEM, confirmacaoPrompt, lembretePrompt, retomadaPrompt } =
    await import('@/agents/lembrete/prompt');

  const { data: prof } = await db
    .from('professional')
    .select('display_name')
    .eq('id', n.professional_id)
    .single();
  const { data: lead } = n.lead_id
    ? await db.from('lead').select('full_name').eq('id', n.lead_id).single()
    : { data: null };

  let userPrompt: string;
  if (n.kind === 'retomada_abandono') {
    userPrompt = retomadaPrompt({ professionalName: prof.display_name, leadName: lead?.full_name });
  } else {
    const { data: appt } = await db
      .from('appointment')
      .select('starts_at, modality, meeting_url')
      .eq('id', n.appointment_id)
      .single();
    const when = new Date(appt.starts_at).toLocaleString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
    });
    const o = {
      professionalName: prof.display_name,
      leadName: lead?.full_name,
      when,
      modality: appt.modality,
      meetingUrl: appt.meeting_url ?? undefined,
    };
    userPrompt = n.kind === 'confirmacao' ? confirmacaoPrompt(o) : lembretePrompt(o);
  }

  const resp = await anthropic.messages.create({
    model: AGENT_MODEL,
    max_tokens: 400,
    system: LEMBRETE_SYSTEM,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const text = resp.content.find((b) => b.type === 'text');
  const raw = text && text.type === 'text' ? text.text : '';
  const subj = /ASSUNTO:\s*(.+)/i.exec(raw)?.[1]?.trim() ?? 'Sobre sua consulta';
  const body = /CORPO:\s*([\s\S]+)/i.exec(raw)?.[1]?.trim() ?? raw.trim();
  return { subject: subj, body };
}
