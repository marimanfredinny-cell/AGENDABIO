// Tipos de domínio + contrato do Store (camada de dados).
// Duas implementações: Supabase (produção) e memória (demo). O orquestrador e
// as rotas dependem só desta interface.

export interface TriageQuestion {
  key: string;
  label: string;
  goal?: string;
  kind: 'open' | 'choice';
  options?: string[];
}

export interface Specialty {
  id: string;
  slug: string;
  label: string;
  council: string;
}

export interface Professional {
  id: string;
  slug: string;
  display_name: string;
  avatar_url: string | null;
  specialty_id: string;
  registration_number: string | null;
  timezone: string;
  reply_to_email: string | null;
}

export interface Service {
  id: string;
  name: string;
  modality: 'online' | 'presencial' | 'ambos';
  visit_type: string;
  duration_minutes: number;
}

export interface TriageTemplate {
  id: string;
  specialty_id: string;
  persona_note: string | null;
  questions: TriageQuestion[];
}

export type Stage =
  | 'triagem'
  | 'captura'
  | 'agendamento'
  | 'concluido'
  | 'abandonado';
export type Intent = 'agendar' | 'duvida' | 'informacao' | 'indefinido';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Conversation {
  id: string;
  professional_id: string;
  stage: Stage;
  intent: Intent | null;
  messages: ChatMessage[];
}

// Pacote que a página pública precisa para renderizar + conduzir a triagem.
export interface PublicProfile {
  professional: Professional;
  specialty: Specialty;
  template: TriageTemplate;
  services: Service[];
}

export interface LeadInput {
  full_name: string;
  phone: string;
  email?: string;
  reason?: string;
  urgency: 'urgente' | 'nao_urgente';
  recurrence: 'primeira_vez' | 'recorrente';
}

export interface AppointmentInput {
  service_id: string;
  starts_at: string;
  ends_at: string;
  modality: 'online' | 'presencial';
}

export interface GoogleIntegration {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null; // ISO
  calendar_id: string;
}

export interface Store {
  getPublicProfileBySlug(slug: string): Promise<PublicProfile | null>;
  getPublicProfileById(professionalId: string): Promise<PublicProfile | null>;
  // Google Calendar (professional_integration provider='google_calendar')
  getGoogleIntegration(professionalId: string): Promise<GoogleIntegration | null>;
  saveGoogleTokens(
    professionalId: string,
    tokens: { access_token?: string | null; refresh_token?: string | null; expires_at?: string | null; calendar_id?: string },
  ): Promise<void>;
  getLeadEmail(conversationId: string): Promise<string | null>;
  createConversation(professionalId: string, greeting: string): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation | null>;
  updateConversation(
    id: string,
    patch: Partial<Pick<Conversation, 'stage' | 'intent' | 'messages'>>,
  ): Promise<void>;
  saveTriageAnswers(
    conversationId: string,
    answers: Array<{ key: string; label: string; answer: string }>,
  ): Promise<void>;
  upsertLead(
    professionalId: string,
    conversationId: string,
    lead: LeadInput,
  ): Promise<{ id: string }>;
  createAppointment(
    professionalId: string,
    conversationId: string,
    appt: AppointmentInput & { gcal_event_id?: string; meeting_url?: string },
  ): Promise<{ id: string }>;
  enqueueNotification(n: {
    professionalId: string;
    conversationId?: string;
    leadId?: string;
    appointmentId?: string;
    kind: 'confirmacao' | 'lembrete_consulta' | 'retomada_abandono';
    to: string;
    subject?: string;
    body?: string;
    scheduledFor: string;
  }): Promise<void>;
}
