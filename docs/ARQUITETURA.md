# Arquitetura — AgendaBio (MVP saúde)

## 1. Como os 4 agentes se comunicam

**Decisão: orquestrador central com máquina de estados** (não agentes autônomos
se chamando). Os agentes são funções especialistas; o "elo" entre eles é o
**estado compartilhado no Supabase** (`conversation.stage`, resumo da triagem,
lead). Handoff explícito e auditável, jornada retomável.

```
        Visitante (página do profissional /slug)
                     │ mensagem
                     ▼
              /api/chat (route)
                     │
                     ▼
             ORQUESTRADOR ──────────►  Store (Supabase | Demo)
          (máquina de estados)          conversation.stage + histórico
        │           │            │
   stage=triagem  captura   agendamento
        ▼           ▼            ▼
   ┌────────┐  ┌────────┐  ┌────────────┐
   │TRIAGEM │─►│ LEAD   │─►│AGENDAMENTO │─► cria appointment
   │Concierge│ │Captura │  │Google Cal  │   + enfileira e-mails
   └────────┘  └────────┘  └─────┬──────┘
        ▲                        ▼
   template do banco     notification (fila) ──► LEMBRETE (cron)
   (por especialidade)                          gera e envia e-mail (Resend)
```

### Diferencial desta versão: triagem é DADO, não código

O Agente de Triagem é **genérico**. As perguntas vêm de `triage_template`
(uma linha por especialidade, array `questions` em JSONB). O prompt do agente é
montado injetando essas perguntas. **Adicionar uma especialidade nova = inserir
linhas em `specialty` + `triage_template`, sem tocar no código dos agentes.**

### Máquina de estados

```
triagem → captura → agendamento → concluido
   │         │
   └─────────┴─ (2h parado) → abandonado → e-mail de retomada (cron)
```

- **triagem → captura**: agente chama `registrar_triagem` (intent + respostas).
- **captura → agendamento**: `salvar_lead` roda e `intent = 'agendar'`
  (senão vai direto para `concluido`).
- **agendamento → concluido**: `confirmar_agendamento` roda → cria evento no
  Google Calendar → enfileira confirmação (imediata) e lembrete (24h antes).
- **abandono**: o cron detecta conversas paradas e enfileira `retomada_abandono`.

Cada agente sinaliza "terminei" via **tool use** da API da Claude, garantindo
saída estruturada limpa no banco (sem parsing frágil).

### Duas trilhas de execução

- **Com `ANTHROPIC_API_KEY`**: agentes reais (Claude + tool use).
- **Sem chave (modo demo)**: `src/lib/demo/engine.ts` percorre o mesmo template
  de forma determinística — prova o fluxo e a UX sem configurar nada.

## 2. Estrutura de dados (Supabase)

Ver `supabase/migrations/0001_init.sql`. Tabelas:

| Tabela | Papel |
|---|---|
| `specialty` | Lista pré-definida (clínico, psicólogo, nutricionista…) + conselho (CRM/CRP/CRN…). |
| `triage_template` | **Perguntas de triagem por especialidade** (JSONB configurável). |
| `professional` | Dono do link; aponta para `specialty_id` + credencial. |
| `professional_integration` | Tokens Google/Resend isolados. |
| `service` | Tipos de consulta (primeira/retorno, online/presencial). |
| `conversation` | Fio condutor: `stage`, `intent`, histórico `messages`. |
| `triage_answer` | Respostas casadas com as `key` do template. |
| `lead` | Contato (nome/telefone/email) + classificação. |
| `appointment` | Agendamento + `gcal_event_id`. |
| `notification` | Fila de e-mails (confirmação/lembrete/retomada). |

Onboarding do profissional → grava `professional` (com `specialty_id`) → a página
pública `/slug` é montada automaticamente a partir do `triage_template` da
especialidade.

## 3. System prompt da triagem

`src/agents/triagem/prompt.ts` é o prompt **genérico** que recebe as perguntas do
template. Exemplos de templates (formato para adicionar as demais) estão no seed
`supabase/migrations/0002_seed.sql`: clínico geral, psicólogo e nutricionista.

## 4. Integrações (estado no protótipo)

- **Google Calendar** (`src/lib/google/calendar.ts`): slots simulados; trocar por
  `freebusy.query` + `events.insert`.
- **Resend** (`src/lib/email/resend.ts`): envia se `RESEND_API_KEY` existir, senão
  loga (modo protótipo).
- **Cron** (`/api/cron/reminders`): agende GET periódico com `x-cron-secret`.
