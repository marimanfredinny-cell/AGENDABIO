-- =============================================================================
-- Seed: especialidades + templates de triagem (formato para adicionar novas)
-- + um profissional de demonstração.
--
-- Para adicionar uma especialidade nova, basta:
--   1. inserir uma linha em `specialty`
--   2. inserir um `triage_template` com o array `questions`
-- Nada muda no código dos agentes.
-- =============================================================================

-- ---- Especialidades (lista pré-definida do cadastro) ----------------------
insert into specialty (slug, label, council, sort_order) values
  ('clinico-geral', 'Clínico(a) Geral', 'CRM', 0),
  ('psicologo',     'Psicólogo(a)',      'CRP', 1),
  ('nutricionista', 'Nutricionista',     'CRN', 2),
  ('dentista',      'Dentista',          'CRO', 3),
  ('fisioterapeuta','Fisioterapeuta',    'CREFITO', 4)
on conflict (slug) do nothing;

-- ---- Template: CLÍNICO GERAL ---------------------------------------------
insert into triage_template (specialty_id, persona_note, questions)
select id,
  'Atendimento clínico geral. Acolha, entenda o motivo e a urgência sem pedir detalhes clínicos íntimos (isso é para a consulta). Sinais de emergência: oriente 192/pronto-socorro.',
  '[
    {"key":"motivo","label":"O que te trouxe até aqui hoje? Me conta com suas palavras.","goal":"entender a queixa principal","kind":"open"},
    {"key":"ha_quanto_tempo","label":"Há quanto tempo você sente isso?","goal":"triagem de urgência","kind":"open"},
    {"key":"primeira_vez","label":"Você já se consultou com o(a) profissional antes?","goal":"primeira vez ou retorno","kind":"choice","options":["Primeira vez","Retorno"]},
    {"key":"modalidade","label":"Você prefere atendimento online ou presencial?","goal":"modalidade","kind":"choice","options":["Online","Presencial"]}
  ]'::jsonb
from specialty where slug = 'clinico-geral';

-- ---- Template: PSICÓLOGO --------------------------------------------------
insert into triage_template (specialty_id, persona_note, questions)
select id,
  'Atendimento psicológico. Tom muito acolhedor e sem julgamento. Não investigue detalhes dolorosos — só o suficiente para direcionar. Sinais de risco (ideação suicida, crise): oriente CVV 188 e marque como urgente.',
  '[
    {"key":"motivo","label":"O que você gostaria de trabalhar na terapia neste momento?","goal":"entender a demanda","kind":"open"},
    {"key":"ja_fez_terapia","label":"Você já fez terapia antes?","goal":"experiência prévia","kind":"choice","options":["Sim, já fiz","Nunca fiz"]},
    {"key":"abordagem_ou_ajuda","label":"Está buscando ajuda para algo específico (ansiedade, luto, relacionamento...) ou um acompanhamento contínuo?","goal":"tipo de demanda","kind":"open"},
    {"key":"modalidade","label":"Prefere sessões online ou presenciais?","goal":"modalidade","kind":"choice","options":["Online","Presencial"]}
  ]'::jsonb
from specialty where slug = 'psicologo';

-- ---- Template: NUTRICIONISTA ---------------------------------------------
insert into triage_template (specialty_id, persona_note, questions)
select id,
  'Atendimento nutricional. Foque no objetivo e no momento da pessoa. Não prescreva dieta nem dê recomendação nutricional — isso é da consulta.',
  '[
    {"key":"objetivo_principal","label":"Qual seu objetivo principal com o acompanhamento nutricional?","goal":"direcionar a demanda","kind":"choice","options":["Emagrecimento","Ganho de massa","Saúde/reeducação alimentar","Condição clínica específica"]},
    {"key":"acompanhamento_previo","label":"Você já fez acompanhamento com nutricionista antes?","goal":"experiência prévia","kind":"choice","options":["Sim","Não"]},
    {"key":"restricao_ou_condicao","label":"Tem alguma restrição alimentar ou condição de saúde que eu deva registrar?","goal":"contexto para a consulta","kind":"open"},
    {"key":"modalidade","label":"Prefere atendimento online ou presencial?","goal":"modalidade","kind":"choice","options":["Online","Presencial"]}
  ]'::jsonb
from specialty where slug = 'nutricionista';

-- ---- Profissional de demonstração ----------------------------------------
insert into professional (slug, display_name, specialty_id, registration_number, timezone, reply_to_email)
select 'dra-marina', 'Dra. Marina Souza', s.id, 'CRP 06/123456', 'America/Sao_Paulo', 'marina@example.com'
from specialty s where s.slug = 'psicologo'
on conflict (slug) do nothing;

insert into service (professional_id, name, modality, visit_type, duration_minutes, sort_order)
select p.id, 'Primeira consulta', 'online', 'primeira', 50, 0 from professional p where p.slug = 'dra-marina'
union all
select p.id, 'Retorno', 'online', 'retorno', 50, 1 from professional p where p.slug = 'dra-marina';
