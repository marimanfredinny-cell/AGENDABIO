# AgendaBio

Link na bio **conversacional para profissionais da saúde**. Um concierge de IA
substitui os botões soltos por uma conversa que qualifica o lead antes de
agendar — reduzindo agenda vazia e no-show. A triagem se adapta automaticamente
à especialidade cadastrada.

## Os 4 agentes

1. **Triagem (Concierge)** — 3–4 perguntas **vindas do banco** conforme a
   especialidade (psicólogo pergunta "já fez terapia?"; nutricionista pergunta
   "qual seu objetivo?"). Descobre se a pessoa quer agendar, tirar dúvida ou
   pedir informação.
2. **Captura & Qualificação** — coleta nome, telefone, e-mail; classifica o lead.
3. **Agendamento** — tipo/data/horário, Google Calendar, e-mail de confirmação.
4. **Lembrete (e-mail)** — lembrete antes da consulta e retomada de abandono.

> Arquitetura e diagrama: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Diferencial: triagem configurável por dado

As perguntas de cada especialidade ficam em `triage_template` (JSONB no
Supabase). Para adicionar uma especialidade nova, insira linhas em `specialty` +
`triage_template` — **sem alterar o código dos agentes**.

## Stack

Next.js 14 · Supabase · API da Claude (Anthropic) · Google Calendar · Resend (e-mail).

## Rodar o protótipo

```bash
npm install
npm run dev
# http://localhost:3000/dra-marina
```

**Sem configurar nada, roda em MODO DEMO**: dados em memória e um concierge
determinístico que percorre o template real da especialidade (triagem → captura →
agendamento → confirmação por e-mail logada). Ótimo pra ver a UX e o fluxo.

Para ativar o **modo real**, preencha `.env.local` (veja `.env.example`):

- `ANTHROPIC_API_KEY` → liga os agentes de IA (Claude).
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` → liga o banco (rode
  `supabase/migrations/0001_init.sql` e `0002_seed.sql` no SQL editor).
- `RESEND_API_KEY` → envia e-mails de verdade.
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI` → Google
  Calendar real.

### Conectar o Google Calendar de um profissional

Com as variáveis do Google preenchidas e o Supabase ativo:

1. Acesse `‎/api/google/connect?professionalId=<id do profissional>` e autorize.
2. O callback salva os tokens em `professional_integration` (com `refresh_token`).
3. A partir daí, a disponibilidade vem do **freebusy** da agenda e cada
   agendamento cria um **evento com Google Meet** (`events.insert`); o token é
   renovado automaticamente. Sem profissional conectado, o sistema usa horários
   simulados (dias úteis, 9h–18h) — por isso o modo demo continua funcionando.

## Estrutura

```
src/
  app/
    [slug]/page.tsx              # página pública gerada do cadastro -> chat
    api/chat/route.ts            # entrada do orquestrador
    api/cron/reminders/route.ts  # e-mails + retomada de abandono
  agents/
    orchestrator.ts              # máquina de estados (coração)
    triagem/  lead/  agendamento/  lembrete/
  lib/
    store/     # Store abstrato: supabase.ts | demo.ts
    demo/engine.ts   # motor do modo demo (sem LLM)
    anthropic.ts  google/  email/  config.ts
supabase/migrations/  # 0001 esquema · 0002 seed (especialidades + templates)
```

## Próximos passos

- Onboarding real (Supabase Auth: compra → conta → cadastro de especialidade).
- Painel do profissional (leads, agenda, conversas) + botão "conectar Google".
- Streaming das respostas do chat.
