# Arquitetura dos Agentes — AgendaBio

## 1. Como os 4 agentes se comunicam

**Decisão: orquestrador central com máquina de estados** (não agentes autônomos
chamando uns aos outros).

```
                     Visitante (link na bio)
                              │  mensagem
                              ▼
                   ┌─────────────────────┐
                   │   /api/chat (route) │
                   └──────────┬──────────┘
                              ▼
                   ┌─────────────────────┐        estado (stage) + histórico
                   │    ORQUESTRADOR     │◄────────────►  Supabase: conversation
                   │  (state machine)    │
                   └──────────┬──────────┘
        stage=triagem │ stage=captura │ stage=agendamento
                      ▼               ▼               ▼
              ┌───────────┐   ┌───────────┐   ┌──────────────┐
              │ 1.TRIAGEM │──▶│ 3.CAPTURA │──▶│ 2.AGENDAMENTO│
              │ Concierge │   │ Lead      │   │ Google Cal   │
              └───────────┘   └───────────┘   └──────┬───────┘
                                                     │ cria appointment
                                                     ▼  + enfileira lembrete
                                          Supabase: lead / appointment / notification
                                                     ▲
                                     ┌───────────────┴───────────────┐
                                     │  4.FOLLOW-UP  (cron/worker)    │
                                     │  lê `notification` pendentes   │
                                     │  gera texto + envia (Twilio)   │
                                     └────────────────────────────────┘
```

### Por que orquestrador central e não agentes autônomos?

| Critério | Orquestrador central (escolhido) | Agentes autônomos |
|---|---|---|
| Fluxo | Linear e previsível (triagem→captura→agendamento) | Flexível, mas imprevisível |
| Custo/latência | Cada agente = prompt pequeno e focado | Mega-prompt ou muitas idas e voltas |
| Retomada | `stage` no banco → jornada retomável, sabe onde parou | Estado difícil de reconstruir |
| Alucinação | Baixa (escopo estreito por agente) | Maior |
| Follow-up de abandono | Trivial: basta olhar `stage` + `last_activity_at` | Complexo |

Os agentes **não conversam entre si**. Eles são funções especialistas
(`runTriageTurn`, `runLeadTurn`, `runSchedulingTurn`) que o orquestrador chama
conforme o `stage`. A "comunicação" entre eles é o **estado compartilhado no
Supabase** (resumo da triagem, intent, lead) — um handoff explícito e auditável.

### Ciclo de vida de uma conversa (stages)

```
triagem ──► captura ──► agendamento ──► concluido
   │            │
   └────────────┴──► (2h parada) ──► abandonado ──► retomada (follow-up)
```

- **triagem → captura**: quando o agente de triagem chama `registrar_triagem`.
- **captura → agendamento**: quando `salvar_lead` roda E `intent = 'agendar'`.
  Se `intent ≠ agendar`, vai direto para `concluido` (lead salvo, sem marcar).
- **agendamento → concluido**: quando `confirmar_agendamento` roda.
- **abandono**: cron detecta conversas paradas e enfileira `retomada_abandono`.

O orquestrador **encadeia stages na mesma requisição** quando possível (ex.:
terminou a triagem e já começa a pedir os dados de contato), parando só quando um
agente devolve texto que exige resposta do visitante.

### Saída estruturada = tool use

Cada agente decide "terminei minha etapa" chamando uma **ferramenta** (tool use
da API da Claude), não interpretando texto livre:

| Agente | Tool | Saída |
|---|---|---|
| Triagem | `registrar_triagem` | intent, urgente, resumo, respostas[] |
| Captura | `salvar_lead` | nome, whatsapp, email, urgência, recorrência |
| Agendamento | `consultar_disponibilidade`, `confirmar_agendamento` | slot + service_id |
| Follow-up | (não conversacional) | texto da mensagem de WhatsApp |

Isso garante dados limpos indo pro banco, sem parsing frágil.

## 2. Estrutura de dados (Supabase)

Ver `supabase/migrations/0001_init.sql`. Resumo das tabelas:

| Tabela | Papel |
|---|---|
| `professional` | Dono do link. Define o **nicho** → variação de prompt de triagem. |
| `professional_integration` | Tokens Google/Twilio isolados (segredos). |
| `service` | Tipos de consulta (primeira/retorno, online/presencial). |
| `conversation` | A jornada do visitante: `stage`, `intent`, histórico `messages`. |
| `triage_answer` | Respostas estruturadas da triagem (qualificação). |
| `lead` | Pessoa qualificada: contato + classificação (urgente, primeira vez). |
| `appointment` | Agendamento + `gcal_event_id` + link da sala. |
| `notification` | Fila de lembretes/retomadas que o worker de follow-up envia. |

Pontos de design:

- **`conversation` é o fio condutor**: guarda o estado da máquina de estados e o
  histórico completo, o que torna a jornada retomável e alimenta o follow-up.
- **`notification` como fila**: agendar um lembrete = inserir uma linha com
  `scheduled_for`. O cron lê os pendentes vencidos e envia. Desacopla "decidir
  lembrar" de "enviar".
- **RLS ligado**: o backend usa `service_role` (bypassa RLS); o painel do
  profissional lê só os próprios dados; o link público lê só o card + serviços.

## 3. Integrações (estado no protótipo)

- **Google Calendar** (`src/lib/google/calendar.ts`): stub com slots simulados.
  Trocar por `freebusy.query` (disponibilidade) e `events.insert` (criar evento
  + Meet), usando o token de `professional_integration`.
- **Twilio/WhatsApp** (`src/lib/twilio/whatsapp.ts`): funciona real se as env
  vars existirem; senão apenas loga (modo protótipo).
- **Cron** (`/api/cron/follow-up`): agende no Vercel Cron / Supabase pg_cron /
  Cloud Scheduler, protegido por `x-cron-secret`.
