// Tipos de domínio compartilhados (espelham o esquema do Supabase).

export type Niche = 'saude' | 'juridico' | 'criativo';
export type Stage = 'triagem' | 'captura' | 'agendamento' | 'concluido' | 'abandonado';
export type Intent = 'agendar' | 'duvida' | 'orcamento' | 'indefinido';

export interface Professional {
  id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  avatar_url: string | null;
  niche: Niche;
  specialty: string | null;
  timezone: string;
  whatsapp_from: string | null;
  is_active: boolean;
}

export interface Service {
  id: string;
  professional_id: string;
  name: string;
  modality: 'online' | 'presencial' | 'ambos';
  visit_type: string;
  duration_minutes: number;
  price_cents: number | null;
}

// Mensagem no formato aceito pela API da Claude (papel + conteúdo).
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
  last_activity_at: string;
}
