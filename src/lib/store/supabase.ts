// Implementação do Store sobre o Supabase (usada quando há credenciais).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AppointmentInput,
  Conversation,
  LeadInput,
  PublicProfile,
  Store,
} from './types';

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function buildProfile(
  db: SupabaseClient,
  professional: any,
): Promise<PublicProfile | null> {
  const [{ data: specialty }, { data: services }] = await Promise.all([
    db.from('specialty').select('*').eq('id', professional.specialty_id).single(),
    db
      .from('service')
      .select('*')
      .eq('professional_id', professional.id)
      .eq('is_active', true)
      .order('sort_order'),
  ]);
  const { data: template } = await db
    .from('triage_template')
    .select('*')
    .eq('specialty_id', professional.specialty_id)
    .eq('is_active', true)
    .single();
  if (!specialty || !template) return null;
  return { professional, specialty, template, services: services ?? [] } as PublicProfile;
}

export const supabaseStore: Store = {
  async getPublicProfileBySlug(slug) {
    const db = admin();
    const { data: professional } = await db
      .from('professional')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();
    if (!professional) return null;
    return buildProfile(db, professional);
  },

  async getPublicProfileById(id) {
    const db = admin();
    const { data: professional } = await db
      .from('professional')
      .select('*')
      .eq('id', id)
      .single();
    if (!professional) return null;
    return buildProfile(db, professional);
  },

  async getProfessionalByAuthId(authUserId) {
    const db = admin();
    const { data: professional } = await db
      .from('professional')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();
    if (!professional) return null;
    return buildProfile(db, professional);
  },

  async createAuthUser(email, password) {
    const db = admin();
    // Cria o usuário já confirmado (acesso instantâneo). Requer service role.
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return data.user?.id ?? null;
  },

  async activateProfessional(slug) {
    const db = admin();
    await db.from('professional').update({ is_active: true }).eq('slug', slug);
  },

  async listSpecialties() {
    const db = admin();
    const { data } = await db
      .from('specialty')
      .select('id, slug, label, council')
      .eq('is_active', true)
      .order('sort_order');
    return data ?? [];
  },

  async createProfessional(input) {
    const db = admin();
    const { data: spec } = await db
      .from('specialty')
      .select('id')
      .eq('slug', input.specialty_slug)
      .single();
    if (!spec) throw new Error('Especialidade inválida');

    // slug único a partir do nome
    let slug =
      input.display_name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'profissional';
    const { data: exists } = await db.from('professional').select('id').eq('slug', slug).maybeSingle();
    if (exists) slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;

    const { data: prof, error } = await db
      .from('professional')
      .insert({
        slug,
        display_name: input.display_name,
        specialty_id: spec.id,
        registration_number: input.registration_number ?? null,
        reply_to_email: input.email ?? null,
        auth_user_id: input.auth_user_id ?? null,
        is_active: input.active ?? true,
      })
      .select('id, slug')
      .single();
    if (error || !prof) throw new Error(error?.message ?? 'Falha ao criar profissional');

    await db.from('service').insert({
      professional_id: prof.id,
      name: 'Primeira consulta',
      modality: 'online',
      visit_type: 'primeira',
      duration_minutes: 50,
      sort_order: 0,
    });
    return { slug: prof.slug };
  },

  async listLeads(professionalId) {
    const db = admin();
    const { data } = await db
      .from('lead')
      .select('id, full_name, phone, email, reason, urgency, recurrence, status, created_at')
      .eq('professional_id', professionalId)
      .order('created_at', { ascending: false })
      .limit(100);
    return data ?? [];
  },

  async listAppointments(professionalId) {
    const db = admin();
    const { data } = await db
      .from('appointment')
      .select('id, starts_at, ends_at, modality, status, meeting_url, lead(full_name), service(name)')
      .eq('professional_id', professionalId)
      .order('starts_at', { ascending: true })
      .limit(100);
    return (data ?? []).map((a: any) => ({
      id: a.id,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
      modality: a.modality,
      status: a.status,
      meeting_url: a.meeting_url,
      lead_name: a.lead?.full_name ?? null,
      service_name: a.service?.name ?? null,
    }));
  },

  async getGoogleIntegration(professionalId) {
    const db = admin();
    const { data } = await db
      .from('professional_integration')
      .select('access_token, refresh_token, expires_at, config')
      .eq('professional_id', professionalId)
      .eq('provider', 'google_calendar')
      .maybeSingle();
    if (!data) return null;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      calendar_id: (data.config?.calendar_id as string) ?? 'primary',
    };
  },

  async saveGoogleTokens(professionalId, tokens) {
    const db = admin();
    // Preserva refresh_token/config existentes quando o refresh só devolve access_token.
    const { data: existing } = await db
      .from('professional_integration')
      .select('refresh_token, config')
      .eq('professional_id', professionalId)
      .eq('provider', 'google_calendar')
      .maybeSingle();

    await db.from('professional_integration').upsert(
      {
        professional_id: professionalId,
        provider: 'google_calendar',
        access_token: tokens.access_token ?? null,
        refresh_token: tokens.refresh_token ?? existing?.refresh_token ?? null,
        expires_at: tokens.expires_at ?? null,
        config: { calendar_id: tokens.calendar_id ?? existing?.config?.calendar_id ?? 'primary' },
      },
      { onConflict: 'professional_id,provider' },
    );
  },

  async getLeadEmail(conversationId) {
    const db = admin();
    const { data } = await db
      .from('lead')
      .select('email')
      .eq('conversation_id', conversationId)
      .maybeSingle();
    return data?.email ?? null;
  },

  async createConversation(professionalId, greeting) {
    const db = admin();
    const { data } = await db
      .from('conversation')
      .insert({
        professional_id: professionalId,
        stage: 'triagem',
        messages: [{ role: 'assistant', content: greeting }],
      })
      .select('*')
      .single();
    return data as Conversation;
  },

  async getConversation(id) {
    const db = admin();
    const { data } = await db.from('conversation').select('*').eq('id', id).single();
    return (data as Conversation) ?? null;
  },

  async updateConversation(id, patch) {
    const db = admin();
    await db
      .from('conversation')
      .update({ ...patch, last_activity_at: new Date().toISOString() })
      .eq('id', id);
  },

  async saveTriageAnswers(conversationId, answers) {
    const db = admin();
    if (!answers.length) return;
    await db.from('triage_answer').upsert(
      answers.map((a) => ({
        conversation_id: conversationId,
        question_key: a.key,
        question_label: a.label,
        answer: a.answer,
      })),
    );
  },

  async upsertLead(professionalId, conversationId, lead: LeadInput) {
    const db = admin();
    const { data } = await db
      .from('lead')
      .upsert(
        {
          professional_id: professionalId,
          conversation_id: conversationId,
          full_name: lead.full_name,
          phone: lead.phone,
          email: lead.email ?? null,
          reason: lead.reason ?? null,
          urgency: lead.urgency,
          recurrence: lead.recurrence,
        },
        { onConflict: 'conversation_id' },
      )
      .select('id')
      .single();
    return { id: data!.id };
  },

  async createAppointment(professionalId, conversationId, appt: AppointmentInput & { gcal_event_id?: string; meeting_url?: string }) {
    const db = admin();
    const { data: lead } = await db
      .from('lead')
      .select('id')
      .eq('conversation_id', conversationId)
      .maybeSingle();
    const { data } = await db
      .from('appointment')
      .insert({
        professional_id: professionalId,
        conversation_id: conversationId,
        lead_id: lead?.id ?? null,
        service_id: appt.service_id,
        starts_at: appt.starts_at,
        ends_at: appt.ends_at,
        modality: appt.modality,
        gcal_event_id: appt.gcal_event_id ?? null,
        meeting_url: appt.meeting_url ?? null,
      })
      .select('id')
      .single();
    return { id: data!.id };
  },

  async enqueueNotification(n) {
    const db = admin();
    await db.from('notification').insert({
      professional_id: n.professionalId,
      conversation_id: n.conversationId ?? null,
      lead_id: n.leadId ?? null,
      appointment_id: n.appointmentId ?? null,
      kind: n.kind,
      channel: 'email',
      to_address: n.to,
      subject: n.subject ?? null,
      body: n.body ?? null,
      scheduled_for: n.scheduledFor,
    });
  },
};
