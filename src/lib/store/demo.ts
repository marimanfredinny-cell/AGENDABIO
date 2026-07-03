// Store em memória para o MODO DEMO — mesmos dados do seed SQL.
// Permite ver o protótipo sem Supabase. Estado se perde ao reiniciar o server.

import { randomUUID } from 'crypto';
import type {
  AppointmentInput,
  AppointmentRecord,
  Conversation,
  LeadInput,
  LeadRecord,
  PublicProfile,
  Specialty,
  Store,
  TriageTemplate,
} from './types';

type DemoLead = LeadRecord & { professional_id: string; conversation_id: string };
type DemoAppt = AppointmentRecord & { professional_id: string; conversation_id: string };

const specialties: Specialty[] = [
  { id: 's-clinico', slug: 'clinico-geral', label: 'Clínico(a) Geral', council: 'CRM' },
  { id: 's-psi', slug: 'psicologo', label: 'Psicólogo(a)', council: 'CRP' },
  { id: 's-nutri', slug: 'nutricionista', label: 'Nutricionista', council: 'CRN' },
];

const templates: Record<string, TriageTemplate> = {
  's-clinico': {
    id: 't-clinico',
    specialty_id: 's-clinico',
    persona_note:
      'Atendimento clínico geral. Acolha e entenda o motivo sem pedir detalhes íntimos.',
    questions: [
      { key: 'motivo', label: 'O que te trouxe até aqui hoje? Me conta com suas palavras.', kind: 'open' },
      { key: 'ha_quanto_tempo', label: 'Há quanto tempo você sente isso?', kind: 'open' },
      { key: 'primeira_vez', label: 'Você já se consultou antes?', kind: 'choice', options: ['Primeira vez', 'Retorno'] },
      { key: 'modalidade', label: 'Prefere atendimento online ou presencial?', kind: 'choice', options: ['Online', 'Presencial'] },
    ],
  },
  's-psi': {
    id: 't-psi',
    specialty_id: 's-psi',
    persona_note:
      'Atendimento psicológico. Tom muito acolhedor e sem julgamento. Risco: oriente CVV 188.',
    questions: [
      { key: 'motivo', label: 'O que você gostaria de trabalhar na terapia neste momento?', kind: 'open' },
      { key: 'ja_fez_terapia', label: 'Você já fez terapia antes?', kind: 'choice', options: ['Sim, já fiz', 'Nunca fiz'] },
      { key: 'tipo_demanda', label: 'Busca ajuda para algo específico ou um acompanhamento contínuo?', kind: 'open' },
      { key: 'modalidade', label: 'Prefere sessões online ou presenciais?', kind: 'choice', options: ['Online', 'Presencial'] },
    ],
  },
  's-nutri': {
    id: 't-nutri',
    specialty_id: 's-nutri',
    persona_note: 'Atendimento nutricional. Foque no objetivo. Não prescreva dieta.',
    questions: [
      { key: 'objetivo_principal', label: 'Qual seu objetivo principal com o acompanhamento nutricional?', kind: 'choice', options: ['Emagrecimento', 'Ganho de massa', 'Saúde/reeducação alimentar', 'Condição clínica'] },
      { key: 'acompanhamento_previo', label: 'Você já fez acompanhamento com nutricionista antes?', kind: 'choice', options: ['Sim', 'Não'] },
      { key: 'restricao', label: 'Tem alguma restrição alimentar ou condição de saúde que eu deva registrar?', kind: 'open' },
      { key: 'modalidade', label: 'Prefere atendimento online ou presencial?', kind: 'choice', options: ['Online', 'Presencial'] },
    ],
  },
};

const seedProfiles: PublicProfile[] = [
  {
    professional: {
      id: 'p-marina',
      slug: 'dra-marina',
      display_name: 'Dra. Marina Souza',
      avatar_url: null,
      specialty_id: 's-psi',
      registration_number: 'CRP 06/123456',
      timezone: 'America/Sao_Paulo',
      reply_to_email: 'marina@example.com',
    },
    specialty: specialties[1],
    template: templates['s-psi'],
    services: [
      { id: 'svc-1', name: 'Primeira consulta', modality: 'online', visit_type: 'primeira', duration_minutes: 50 },
      { id: 'svc-2', name: 'Retorno', modality: 'online', visit_type: 'retorno', duration_minutes: 50 },
    ],
  },
  {
    professional: {
      id: 'p-nutri',
      slug: 'dr-nutri',
      display_name: 'Dr. Rafael Lima',
      avatar_url: null,
      specialty_id: 's-nutri',
      registration_number: 'CRN 3/45678',
      timezone: 'America/Sao_Paulo',
      reply_to_email: 'rafael@example.com',
    },
    specialty: specialties[2],
    template: templates['s-nutri'],
    services: [
      { id: 'svc-3', name: 'Primeira consulta', modality: 'online', visit_type: 'primeira', duration_minutes: 60 },
    ],
  },
];

// Estado mutável do demo em globalThis: no Next dev, route handlers e server
// components são empacotados em grafos de módulo separados; sem o singleton
// global, cada um teria sua própria cópia e o profissional criado no onboarding
// não apareceria na página pública.
type DemoState = {
  profiles: PublicProfile[];
  conversations: Map<string, Conversation>;
  leads: DemoLead[];
  appointments: DemoAppt[];
};
const g = globalThis as unknown as { __agendabioDemo?: DemoState };
const demo: DemoState = (g.__agendabioDemo ??= {
  profiles: seedProfiles,
  conversations: new Map(),
  leads: [],
  appointments: [],
});
// Blindagem contra singleton antigo (hot-reload) que não tinha estes campos.
demo.profiles ??= seedProfiles;
demo.conversations ??= new Map();
demo.leads ??= [];
demo.appointments ??= [];
const profiles = demo.profiles;
const conversations = demo.conversations;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const demoStore: Store = {
  async getPublicProfileBySlug(slug) {
    return profiles.find((p) => p.professional.slug === slug) ?? null;
  },
  async getPublicProfileById(id) {
    return profiles.find((p) => p.professional.id === id) ?? null;
  },
  async getGoogleIntegration() {
    // Modo demo não tem Google conectado -> slots simulados.
    return null;
  },
  async saveGoogleTokens() {
    /* no-op no demo */
  },
  async getLeadEmail(conversationId) {
    return demo.leads.find((l) => l.conversation_id === conversationId)?.email ?? null;
  },
  async listSpecialties() {
    return specialties;
  },
  async createProfessional(input) {
    const spec = specialties.find((s) => s.slug === input.specialty_slug);
    const template = spec ? templates[spec.id] : undefined;
    if (!spec || !template) throw new Error('Especialidade sem template');

    let slug = slugify(input.display_name) || 'profissional';
    if (profiles.some((p) => p.professional.slug === slug)) {
      slug = `${slug}-${Math.floor(Math.random() * 900 + 100)}`;
    }
    const id = randomUUID();
    profiles.push({
      professional: {
        id,
        slug,
        display_name: input.display_name,
        avatar_url: null,
        specialty_id: spec.id,
        registration_number: input.registration_number ?? null,
        timezone: 'America/Sao_Paulo',
        reply_to_email: input.email ?? null,
      },
      specialty: spec,
      template,
      services: [
        { id: `svc-${id}`, name: 'Primeira consulta', modality: 'online', visit_type: 'primeira', duration_minutes: 50 },
      ],
    });
    return { slug };
  },
  async createConversation(professionalId, greeting) {
    const conv: Conversation = {
      id: randomUUID(),
      professional_id: professionalId,
      stage: 'triagem',
      intent: null,
      messages: [{ role: 'assistant', content: greeting }],
    };
    conversations.set(conv.id, conv);
    return conv;
  },
  async getConversation(id) {
    return conversations.get(id) ?? null;
  },
  async updateConversation(id, patch) {
    const c = conversations.get(id);
    if (c) conversations.set(id, { ...c, ...patch });
  },
  async saveTriageAnswers() {
    /* no-op no demo (respostas ficam no histórico) */
  },
  async upsertLead(professionalId, conversationId, lead: LeadInput) {
    const existing = demo.leads.find((l) => l.conversation_id === conversationId);
    if (existing) {
      Object.assign(existing, lead);
      return { id: existing.id };
    }
    const rec: DemoLead = {
      id: randomUUID(),
      professional_id: professionalId,
      conversation_id: conversationId,
      full_name: lead.full_name,
      phone: lead.phone,
      email: lead.email ?? null,
      reason: lead.reason ?? null,
      urgency: lead.urgency,
      recurrence: lead.recurrence,
      status: 'novo',
      created_at: new Date().toISOString(),
    };
    demo.leads.push(rec);
    return { id: rec.id };
  },
  async createAppointment(professionalId, conversationId, appt: AppointmentInput) {
    const lead = demo.leads.find((l) => l.conversation_id === conversationId);
    const profile = profiles.find((p) => p.professional.id === professionalId);
    const service = profile?.services.find((s) => s.id === appt.service_id);
    const rec: DemoAppt = {
      id: randomUUID(),
      professional_id: professionalId,
      conversation_id: conversationId,
      starts_at: appt.starts_at,
      ends_at: appt.ends_at,
      modality: appt.modality,
      status: 'confirmado',
      lead_name: lead?.full_name ?? null,
      service_name: service?.name ?? null,
      meeting_url: null,
    };
    if (lead) lead.status = 'agendado';
    demo.appointments.push(rec);
    return { id: rec.id };
  },
  async listLeads(professionalId) {
    return demo.leads
      .filter((l) => l.professional_id === professionalId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async listAppointments(professionalId) {
    return demo.appointments
      .filter((a) => a.professional_id === professionalId)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  },
  async enqueueNotification(n) {
    console.log(`[demo][email:${n.kind}] para ${n.to} @ ${n.scheduledFor}`);
  },
};
