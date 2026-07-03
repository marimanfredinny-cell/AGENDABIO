// Store em memória para o MODO DEMO — mesmos dados do seed SQL.
// Permite ver o protótipo sem Supabase. Estado se perde ao reiniciar o server.

import { randomUUID } from 'crypto';
import type {
  AppointmentInput,
  Conversation,
  LeadInput,
  PublicProfile,
  Specialty,
  Store,
  TriageTemplate,
} from './types';

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

const profiles: PublicProfile[] = [
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

const conversations = new Map<string, Conversation>();

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
  async getLeadEmail() {
    return null;
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
  async upsertLead(_p, _c, _lead: LeadInput) {
    return { id: randomUUID() };
  },
  async createAppointment(_p, _c, _a: AppointmentInput) {
    return { id: randomUUID() };
  },
  async enqueueNotification(n) {
    console.log(`[demo][email:${n.kind}] para ${n.to} @ ${n.scheduledFor}`);
  },
};
