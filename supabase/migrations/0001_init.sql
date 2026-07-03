-- =============================================================================
-- AGENDABIO — Esquema inicial (MVP saúde)
-- Concierge de IA no link na bio para profissionais da saúde.
--
-- Ideia central: as PERGUNTAS DE TRIAGEM são DADO CONFIGURÁVEL, não código.
-- Cada especialidade tem um `triage_template` com um array de perguntas; o
-- Agente de Triagem é genérico e apenas consome esse template. Adicionar uma
-- nova especialidade = inserir linhas em `specialty` + `triage_template`,
-- sem tocar no sistema de agentes.
--
-- Fase MVP: só saúde, sem WhatsApp (chat na web), lembrete/confirmação por
-- e-mail, sem pagamento.
-- =============================================================================

create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. SPECIALTY  (lista pré-definida de especialidades da saúde)
--    Configurável: o profissional escolhe uma no cadastro.
-- =============================================================================
create table specialty (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,        -- 'psicologo'
  label       text not null,               -- 'Psicólogo(a)'
  -- Conselho/registro esperado para validar a credencial no onboarding.
  council     text not null,               -- 'CRP' | 'CRM' | 'CRN' | 'CRO' | 'CREFITO'
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- =============================================================================
-- 2. TRIAGE_TEMPLATE  (perguntas de triagem por especialidade — DADO)
--    Uma versão ativa por especialidade. `questions` é um array ordenado.
--    Formato de cada pergunta (jsonb):
--      {
--        "key": "objetivo_principal",
--        "label": "Qual seu objetivo principal com o acompanhamento?",
--        "goal": "entender a demanda para direcionar",   -- ajuda o agente
--        "kind": "open" | "choice",
--        "options": ["Emagrecimento", "Ganho de massa", "Saúde"]  -- se choice
--      }
-- =============================================================================
create table triage_template (
  id           uuid primary key default gen_random_uuid(),
  specialty_id uuid not null references specialty(id) on delete cascade,
  version      int not null default 1,
  is_active    boolean not null default true,
  -- Tom/observações específicas da especialidade injetadas no prompt do agente.
  persona_note text,
  questions    jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger trg_triage_template_updated
  before update on triage_template
  for each row execute function set_updated_at();
-- No máximo um template ativo por especialidade.
create unique index uq_triage_template_active
  on triage_template(specialty_id) where is_active;

-- =============================================================================
-- 3. PROFESSIONAL  (dono do link — criado no onboarding)
-- =============================================================================
create table professional (
  id                   uuid primary key default gen_random_uuid(),
  auth_user_id         uuid unique references auth.users(id) on delete set null,

  slug                 text unique not null,       -- agendabio.com.br/dra-marina
  display_name         text not null,
  avatar_url           text,

  specialty_id         uuid not null references specialty(id),
  -- Credencial profissional (ex.: "CRP 06/123456"). O prefixo vem do conselho
  -- da especialidade; guardamos o valor informado.
  registration_number  text,

  timezone             text not null default 'America/Sao_Paulo',
  reply_to_email       text,                        -- e-mail que recebe os leads
  is_active            boolean not null default true,

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger trg_professional_updated
  before update on professional
  for each row execute function set_updated_at();

-- =============================================================================
-- 4. PROFESSIONAL_INTEGRATION  (credenciais Google/Resend por provedor)
-- =============================================================================
create table professional_integration (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references professional(id) on delete cascade,
  provider         text not null check (provider in ('google_calendar', 'resend')),
  access_token     text,
  refresh_token    text,
  expires_at       timestamptz,
  config           jsonb not null default '{}'::jsonb,  -- ex: {"calendar_id":"primary"}
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (professional_id, provider)
);
create trigger trg_integration_updated
  before update on professional_integration
  for each row execute function set_updated_at();

-- =============================================================================
-- 5. SERVICE  (tipos de consulta configuráveis)
-- =============================================================================
create table service (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references professional(id) on delete cascade,
  name             text not null,                 -- "Primeira consulta"
  modality         text not null default 'online'
                   check (modality in ('online', 'presencial', 'ambos')),
  visit_type       text not null default 'primeira'
                   check (visit_type in ('primeira', 'retorno', 'avaliacao', 'outro')),
  duration_minutes int not null default 50,
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

-- =============================================================================
-- 6. CONVERSATION  (a jornada do visitante = fio condutor da máquina de estados)
-- =============================================================================
create table conversation (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references professional(id) on delete cascade,

  stage            text not null default 'triagem'
                   check (stage in ('triagem', 'captura', 'agendamento',
                                    'concluido', 'abandonado')),
  intent           text
                   check (intent in ('agendar', 'duvida', 'informacao', 'indefinido')),

  messages         jsonb not null default '[]'::jsonb,   -- histórico role/content
  visitor_ref      text,

  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_conversation_updated
  before update on conversation
  for each row execute function set_updated_at();
create index idx_conversation_prof on conversation(professional_id);
-- Índice do job de retomada de abandono.
create index idx_conversation_followup
  on conversation(stage, last_activity_at)
  where stage in ('triagem', 'captura');

-- =============================================================================
-- 7. TRIAGE_ANSWER  (respostas estruturadas — casadas com as keys do template)
-- =============================================================================
create table triage_answer (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references conversation(id) on delete cascade,
  question_key     text not null,     -- mesma key do triage_template.questions
  question_label   text not null,
  answer           text,
  created_at       timestamptz not null default now(),
  unique (conversation_id, question_key)
);

-- =============================================================================
-- 8. LEAD  (pessoa qualificada — saída do agente de captura)
-- =============================================================================
create table lead (
  id               uuid primary key default gen_random_uuid(),
  professional_id  uuid not null references professional(id) on delete cascade,
  conversation_id  uuid unique references conversation(id) on delete set null,

  full_name        text,
  phone            text,          -- telefone (não é WhatsApp API nesta fase)
  email            text,
  reason           text,          -- motivo (resumo da triagem)

  urgency          text not null default 'nao_urgente'
                   check (urgency in ('urgente', 'nao_urgente')),
  recurrence       text not null default 'primeira_vez'
                   check (recurrence in ('primeira_vez', 'recorrente')),
  status           text not null default 'novo'
                   check (status in ('novo', 'em_contato', 'agendado', 'ganho', 'perdido')),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger trg_lead_updated
  before update on lead for each row execute function set_updated_at();
create index idx_lead_prof on lead(professional_id, status);

-- =============================================================================
-- 9. APPOINTMENT  (agendamento — saída do agente de agendamento)
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
                     check (status in ('confirmado', 'cancelado', 'realizado', 'no_show')),

  gcal_event_id      text,
  meeting_url        text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create trigger trg_appointment_updated
  before update on appointment for each row execute function set_updated_at();
create index idx_appointment_prof_time on appointment(professional_id, starts_at);

-- =============================================================================
-- 10. NOTIFICATION  (fila de e-mails do agente de lembrete)
-- =============================================================================
create table notification (
  id                  uuid primary key default gen_random_uuid(),
  professional_id     uuid not null references professional(id) on delete cascade,
  lead_id             uuid references lead(id) on delete set null,
  appointment_id      uuid references appointment(id) on delete cascade,
  conversation_id     uuid references conversation(id) on delete set null,

  kind                text not null
                      check (kind in ('confirmacao', 'lembrete_consulta', 'retomada_abandono')),
  channel             text not null default 'email' check (channel in ('email')),
  to_address          text not null,
  subject             text,
  body                text,

  scheduled_for       timestamptz not null,
  status              text not null default 'pendente'
                      check (status in ('pendente', 'enviado', 'falhou', 'cancelado')),
  provider_message_id text,
  error               text,
  sent_at             timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create trigger trg_notification_updated
  before update on notification for each row execute function set_updated_at();
create index idx_notification_due
  on notification(scheduled_for) where status = 'pendente';

-- =============================================================================
-- RLS: backend usa service_role (bypassa). Leitura pública mínima do link.
-- =============================================================================
alter table specialty        enable row level security;
alter table triage_template  enable row level security;
alter table professional     enable row level security;
alter table service          enable row level security;
alter table conversation     enable row level security;
alter table triage_answer    enable row level security;
alter table lead             enable row level security;
alter table appointment      enable row level security;
alter table notification     enable row level security;
alter table professional_integration enable row level security;

create policy "public reads specialties"
  on specialty for select using (is_active = true);

create policy "public reads active professional"
  on professional for select using (is_active = true);

create policy "public reads active services"
  on service for select using (is_active = true);

create policy "owner manages own professional"
  on professional for all
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "owner reads own leads"
  on lead for select
  using (professional_id in (select id from professional where auth_user_id = auth.uid()));

create policy "owner reads own appointments"
  on appointment for select
  using (professional_id in (select id from professional where auth_user_id = auth.uid()));
