# AgendaBio

Link na bio **conversacional** para profissionais liberais (saúde, jurídico,
criativo/coach). Em vez de botões soltos, um sistema de **agentes de IA** que
qualifica o lead antes de agendar — para reduzir agenda vazia e no-show.

## Os 4 agentes

1. **Triagem (Concierge)** — 3–4 perguntas adaptadas ao nicho; descobre se a
   pessoa quer agendar, tirar dúvida ou pedir orçamento.
2. **Captura & Qualificação** — coleta nome, WhatsApp, e-mail; classifica o lead
   (urgente/não, primeira vez/recorrente) e salva estruturado.
3. **Agendamento** — conduz tipo/data/horário, integra Google Calendar e
   confirma; enfileira o lembrete.
4. **Follow-up / Lembrete** — envia lembrete antes da consulta e retomada quando
   a pessoa abandona a triagem (via WhatsApp/Twilio).

> Arquitetura completa e diagrama: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Stack

- **Next.js 14** (App Router) — front + route handlers
- **Supabase** (Postgres + Auth + RLS) — dados
- **API da Claude (Anthropic)** — agentes conversacionais (tool use)
- **Google Calendar API** — agendamento
- **Twilio / WhatsApp Cloud** — mensagens

## Estrutura

```
src/
  app/
    [slug]/page.tsx            # link público (/dra-marina) -> chat
    api/chat/route.ts          # entrada do orquestrador
    api/cron/follow-up/route.ts# lembretes + retomada de abandono
  agents/
    orchestrator.ts            # máquina de estados (coração)
    triagem/  lead/  agendamento/  followup/   # 1 pasta por agente (prompt+lógica)
  lib/
    anthropic.ts  supabase/  google/  twilio/
supabase/migrations/           # esquema (0001) + seed (0002)
```

## Rodar o protótipo local

```bash
# 1. Dependências
npm install

# 2. Ambiente
cp .env.example .env.local     # preencha ANTHROPIC_API_KEY e as chaves Supabase

# 3. Banco (no SQL editor do Supabase, rode em ordem):
#    supabase/migrations/0001_init.sql
#    supabase/migrations/0002_seed.sql

# 4. Subir
npm run dev
# abra http://localhost:3000/dra-marina
```

Sem credenciais Twilio/Google o app roda em **modo protótipo**: os horários são
simulados e o WhatsApp é apenas logado no console — o fluxo conversacional
(triagem → captura → agendamento) funciona ponta a ponta.

## Cron de follow-up

Agende um GET periódico (a cada ~15min) em `/api/cron/follow-up` com o header
`x-cron-secret: $CRON_SECRET` (Vercel Cron, Supabase pg_cron ou Cloud Scheduler).

## Próximos passos sugeridos

- Implementar OAuth + chamadas reais do Google Calendar em `src/lib/google/`.
- Webhook de status da Twilio em `src/app/api/webhooks/twilio`.
- Painel do profissional (leads, agenda, conversas) usando a anon key + RLS.
- Streaming das respostas do chat para reduzir a sensação de latência.
