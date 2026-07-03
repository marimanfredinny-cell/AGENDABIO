-- =============================================================================
-- AGENDABIO — Esquema inicial
-- Link na bio conversacional com agentes de IA para profissionais liberais.
--
-- Convenções:
--   * Todo id é uuid (gen_random_uuid()).
--   * created_at / updated_at em todas as tabelas de negócio.
--   * enums via CHECK para facilitar migração; troque por tipos ENUM se preferir.
--   * RLS habilitado. O acesso público (visitante do link) passa SEMPRE pela
--     service_role no backend (nunca pela anon key), então as policies abaixo
--     liberam leitura pública só do necessário (profissional + config do link).
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helper: updated_at automático
-- -----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. PROFISSIONAL  (o dono do link na bio)
-- =============================================================================
create table professional (
  id             uuid primary key default gen_random_uuid(),
  -- vínculo com auth.users do Supabase (o profissional loga no painel)
  auth_user_id   uuid unique references auth.users(id) on delete set null,

  slug           text unique not null,           -- agendabio.com/dra-marina
  display_name   text not null,                  -- "Dra. Marina Souza"
  headline       text,                           -- "Psicóloga | Ansiedade e TCC"
  avatar_url     text,

  -- Nicho define QUAL variação de prompt de triagem é usada.
  niche          text not null
                 check (niche in ('saude', 'juridico', 'criativo')),
  -- Sub-especialidade livre, injetada no prompt (ex: "Psicologia - TCC",
  -- "Direito de família", "Coach de carreira").
  specialty      text,

  -- Configuração de agenda / integrações (tokens ficam em professional_integration)
  timezone       text not null default 'America/Sao_Paulo',
  whatsapp_from  text,                            -- número Twilio/WABA de envio
  is_active      boolean not null default true,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger trg_professional_updated
  before update on professional
  for each row execute function set_updated_at();

-- =============================================================================
-- 2. PROFESSIONAL_INTEGRATION  (credenciais externas, 1:N por provedor)
--    Separado da tabela professional para isolar segredos e RLS mais restrita.
-- =============================================================================
create table professional_integration (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references professional(id) on delete cascade,
  provider         text not null
                   check (provider in ('google_calendar', 'twilio', 'whatsapp_cloud')),

  -- OAuth / API (armazene idealmente criptografado ou no Vault do Supabase)
  access_token     text,
  refresh_token    text,
  expires_at       timestamptz,
  -- ex: google_calendar -> {"calendar_id": "primary"}
  config           jsonb not null default '{}'::jsonb,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (professional_id, provider)
);
create trigger trg_integration_updated
  before update on professional_integration
  for each row execute function set_updated_at();

-- =============================================================================
-- 3. SERVICE  (tipos de consulta/atendimento configuráveis pelo profissional)
--    Alimenta o Agente de Agendamento (primeira consulta, retorno, online...).
-- =============================================================================
create table service (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references professional(id) on delete cascade,
  name             text not null,                 -- "Primeira consulta"
  modality         text not null default 'online'
                   check (modality in ('online', 'presencial', 'ambos')),
  visit_type       text not null default 'primeira'
                   check (visit_type in ('primeira', 'retorno', 'avaliacao', 'outro')),
  duration_minutes int  not null default 50,
  price_cents      int,                           -- null = sob consulta
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

-- =============================================================================
-- 4. CONVERSATION  (uma sessão de chat no link na bio = uma jornada do visitante)
--    É o "fio" que costura triagem -> lead -> agendamento -> follow-up.
-- =============================================================================
create table conversation (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references professional(id) on delete cascade,

  -- Estado da máquina de estados do orquestrador
  stage            text not null default 'triagem'
                   check (stage in ('triagem', 'captura', 'agendamento',
                                    'concluido', 'abandonado')),
  -- Intenção detectada pela triagem
  intent           text
                   check (intent in ('agendar', 'duvida', 'orcamento', 'indefinido')),

  -- Histórico completo de mensagens do chat (role/content da API da Claude).
  -- Mantido aqui para retomar a conversa e para o follow-up de abandono.
  messages         jsonb not null default '[]'::jsonb,

  -- Metadados de origem
  source           text default 'bio_link',       -- bio_link | whatsapp | ...
  visitor_ref      text,                           -- cookie/anon id do visitante

  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_conversation_updated
  before update on conversation
  for each row execute function set_updated_at();
create index idx_conversation_prof on conversation(professional_id);
create index idx_conversation_stage on conversation(stage);
-- Índice para o job de follow-up de abandono (conversas paradas na triagem/captura)
create index idx_conversation_followup
  on conversation(stage, last_activity_at)
  where stage in ('triagem', 'captura');

-- =============================================================================
-- 5. TRIAGE_ANSWER  (respostas estruturadas da triagem, além do texto livre)
--    O Agente de Triagem grava aqui pergunta -> resposta para qualificar o lead.
-- =============================================================================
create table triage_answer (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversation(id) on delete cascade,
  question_key     text not null,   -- ex: 'ja_fez_terapia', 'area_direito'
  question_label   text not null,   -- texto exibido ao visitante
  answer           text,
  created_at       timestamptz not null default now(),
  unique (conversation_id, question_key)
);

-- =============================================================================
-- 6. LEAD  (pessoa qualificada — saída do Agente de Captura/Qualificação)
-- =============================================================================
create table lead (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references professional(id) on delete cascade,
  conversation_id  uuid unique references conversation(id) on delete set null,

  full_name        text,
  whatsapp         text,          -- E.164: +5511999999999
  email            text,
  reason           text,          -- motivo do contato (resumo da triagem)

  -- Classificação gerada pelo agente de qualificação
  urgency          text not null default 'nao_urgente'
                   check (urgency in ('urgente', 'nao_urgente')),
  recurrence       text not null default 'primeira_vez'
                   check (recurrence in ('primeira_vez', 'recorrente')),
  status           text not null default 'novo'
                   check (status in ('novo', 'em_contato', 'agendado',
                                     'ganho', 'perdido')),
  score            int,           -- 0-100 opcional (lead scoring)

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_lead_updated
  before update on lead
  for each row execute function set_updated_at();
create index idx_lead_prof on lead(professional_id);
create index idx_lead_status on lead(professional_id, status);

-- =============================================================================
-- 7. APPOINTMENT  (agendamento — saída do Agente de Agendamento)
-- =============================================================================
create table appointment (
  id                 uuid primary key default gen_random_uuid(),
  professional_id    uuid not null references professional(id) on delete cascade,
  lead_id            uuid references lead(id) on delete set null,
  conversation_id    uuid references conversation(id) on delete set null,
  service_id         uuid references service(id) on delete set null,

  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  modality           text not null default 'online'
                     check (modality in ('online', 'presencial')),

  status             text not null default 'confirmado'
                     check (status in ('confirmado', 'cancelado',
                                       'realizado', 'no_show')),

  -- Integração Google Calendar
  gcal_event_id      text,
  meeting_url        text,          -- link do Meet/sala online

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_appointment_updated
  before update on appointment
  for each row execute function set_updated_at();
create index idx_appointment_prof_time on appointment(professional_id, starts_at);

-- =============================================================================
-- 8. NOTIFICATION  (fila de mensagens do Agente de Follow-up / Lembrete)
--    Um worker/cron lê os pendentes cujo scheduled_for <= now() e envia.
-- =============================================================================
create table notification (
  id                 uuid primary key default gen_random_uuid(),
  professional_id    uuid not null references professional(id) on delete cascade,
  lead_id            uuid references lead(id) on delete set null,
  appointment_id     uuid references appointment(id) on delete cascade,
  conversation_id    uuid references conversation(id) on delete set null,

  kind               text not null
                     check (kind in ('lembrete_consulta',
                                     'retomada_abandono',
                                     'confirmacao')),
  channel            text not null default 'whatsapp'
                     check (channel in ('whatsapp', 'email')),
  to_address         text not null,          -- número/e-mail destino
  body               text not null,

  scheduled_for      timestamptz not null,   -- quando disparar
  status             text not null default 'pendente'
                     check (status in ('pendente', 'enviado', 'falhou', 'cancelado')),
  provider_message_id text,                   -- SID Twilio / id WABA
  error              text,
  sent_at            timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_notification_updated
  before update on notification
  for each row execute function set_updated_at();
-- Índice do worker de envio
create index idx_notification_due
  on notification(scheduled_for)
  where status = 'pendente';

-- =============================================================================
-- ROW LEVEL SECURITY
-- Regra geral: o BACKEND usa service_role (bypassa RLS). As policies abaixo
-- servem para (a) leitura pública mínima do link e (b) o painel do profissional.
-- =============================================================================
alter table professional            enable row level security;
alter table professional_integration enable row level security;
alter table service                 enable row level security;
alter table conversation            enable row level security;
alter table triage_answer           enable row level security;
alter table lead                    enable row level security;
alter table appointment             enable row level security;
alter table notification            enable row level security;

-- Leitura pública apenas do card do profissional ativo (para renderizar o link)
create policy "public reads active professional"
  on professional for select
  using (is_active = true);

-- Serviços visíveis publicamente (para o menu de agendamento)
create policy "public reads active services"
  on service for select
  using (is_active = true);

-- Painel: o profissional lê/gerencia só os seus próprios dados
create policy "owner manages own professional"
  on professional for all
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- Macro para "o registro pertence ao profissional logado"
create policy "owner reads own leads"
  on lead for select
  using (professional_id in
         (select id from professional where auth_user_id = auth.uid()));

create policy "owner reads own appointments"
  on appointment for select
  using (professional_id in
         (select id from professional where auth_user_id = auth.uid()));

create policy "owner reads own conversations"
  on conversation for select
  using (professional_id in
         (select id from professional where auth_user_id = auth.uid()));

-- (integration/notification/triage_answer ficam sem policy pública:
--  acessíveis somente via service_role no backend.)
