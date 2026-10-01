# Arquitetura

## Visão geral

```
Instagram ──webhook──▶ /api/webhook ──after()──▶ webhook-processor
   ▲                        │ 200 imediato             │
   │                        ▼                          ▼
   │                  valida assinatura        trigger-matcher ─▶ flow-engine ─▶ node-executors
   │                                                                   │               │
   └──────────── Graph API (messages, replies) ◀── messaging-service ◀─┘               │
                                                                                       ▼
Supabase Postgres ◀── services (admin client) ◀──────────────── delays longos ──▶ scheduled_jobs
     │ RLS + Realtime                                                                 ▲
     ▼                                                                                │
Painel Next.js (Server Components + Server Actions, sessão do usuário)     pg_cron ──▶ /api/cron/process-jobs
```

## Decisões importantes

### 1. Multi-tenant com Row Level Security
Toda tabela de negócio tem `organization_id`. O isolamento é garantido **no banco** por políticas RLS
(`is_org_member`, `has_org_role`), não só pelo código. Mesmo que um bug na aplicação esqueça um filtro,
o Postgres não devolve dados de outra organização. O arquivo `tests/database-rls.mjs` prova isso.

Camadas de defesa adicionais:
- **Grants por coluna**: o papel `authenticated` não enxerga `access_token_encrypted` e não consegue alterar
  `plan_id`/`subscription_status` (só o backend, via service_role, altera plano).
- A linha do **owner** é imutável pela API (não pode ser rebaixado, removido nem ninguém promovido a owner).
- Funções internas (`claim_due_jobs`, `increment_automation_runs`) não são executáveis pela API pública.

### 2. Dois clientes Supabase, com papéis distintos
- `lib/supabase/server.ts` — sessão do usuário, **respeita RLS**. Usado por páginas e Server Actions.
- `lib/supabase/admin.ts` — service_role, **ignora RLS**. Usado apenas onde não há usuário
  (webhooks, cron, OAuth callback). Toda query nele filtra explicitamente por organização/conta.

### 3. Webhook: responder rápido, processar depois
A Meta desativa webhooks lentos ou que falham. O endpoint valida a assinatura HMAC, responde `200`
e processa com `after()` (o Next mantém a função viva após a resposta). O payload bruto vai para
`webhook_events` (auditoria/debug) e a idempotência é garantida por índices únicos em `messages.mid`
e `comments.comment_id` — webhooks repetidos não disparam fluxos duas vezes.

### 4. Delays em ambiente serverless
Funções serverless não podem "dormir" por horas. O motor usa duas estratégias:
- **≤ 15 s**: espera na própria execução (efeito de "digitando…").
- **> 15 s**: grava um job `resume_run` em `scheduled_jobs` e encerra. O **pg_cron do Supabase** chama
  `/api/cron/process-jobs` a cada minuto; o `claim_due_jobs` usa `FOR UPDATE SKIP LOCKED`, então execuções
  concorrentes nunca pegam o mesmo job. Jobs com erro têm retry com backoff exponencial.

Por que pg_cron e não Vercel Cron? No plano Hobby a Vercel só permite cron **diário**; o Supabase grátis
permite a cada minuto.

### 5. Motor de fluxos desacoplado da UI
O fluxo é salvo como JSON (`{ nodes, edges }`) no mesmo formato do React Flow, com tipos em `types/flow.ts`
compartilhados por cliente e servidor. No servidor:
- `FlowGraph` indexa nós/arestas (navegação O(1) por `nó + saída`).
- `NODE_EXECUTORS` é um registro por tipo de nó (**Open/Closed**: um novo passo = um novo executor, sem
  alterar o motor).
- Cada saída tem nome: `next`, `true`/`false` (condição) ou `btn:<id>` (resposta rápida).
- Botões carregam o payload `r:<runId>:<nodeId>:<buttonId>`; o clique retoma exatamente aquela execução.
- Limite de 40 passos por execução evita loops infinitos.

### 6. Regras da Meta tratadas no motor
- **Resposta privada**: a primeira DM a partir de um comentário é enviada com `recipient.comment_id`
  (única forma permitida); o contexto marca `privateReplyUsed`.
- **Janela de 24h**: a Meta só permite mensagens até 24h após a última mensagem do contato. Por isso os
  modelos usam um botão logo na primeira DM — o clique abre a janela. Erros de janela são registrados
  de forma legível nos logs e na inbox.
- **Human takeover**: quando alguém da equipe responde (pelo painel ou pelo app do Instagram — detectado
  pelos ecos `is_echo`), automações e IA pausam na conversa pelo tempo configurado.

### 7. Prioridade de resposta a uma DM
1. Clique em botão de fluxo em andamento
2. Resposta a story com automação dedicada
3. Automação de palavra-chave (a de maior prioridade vence; específicas antes de "qualquer texto")
4. IA automática (se ligada na organização e na conversa)
5. Resposta padrão (no máximo 1x a cada 24h por contato)

### 8. Segurança
- Tokens da Meta criptografados com AES-256-GCM (`TOKEN_ENCRYPTION_KEY`), nunca enviados ao navegador.
- OAuth com `state` assinado (HMAC) + cookie httpOnly (proteção CSRF) e verificação do usuário logado.
- Assinaturas `X-Hub-Signature-256` e `signed_request` comparadas em tempo constante.
- IDs do Instagram (17+ dígitos) são lidos sem perda de precisão (`lib/safe-json.ts`).
- Endpoints de cron exigem `Authorization: Bearer <CRON_SECRET>`.
- Todas as Server Actions validam entrada com Zod e reconferem a organização ativa.

### 9. Server Actions para a UI, Route Handlers para o mundo externo
Mutações do painel usam Server Actions (tipadas ponta a ponta, sem boilerplate de fetch). Tudo que é
chamado por terceiros (Meta, pg_cron, Stripe) é Route Handler em `/api`, com autenticação própria.

### 10. Planos e Stripe
Limites ficam em `plans.limits` (JSON) e são verificados no backend (`plan-service.ts`) ao conectar contas,
ativar automações, convidar membros e gerar respostas de IA. A cobrança passa pela interface
`BillingProvider`; para ativar o Stripe basta implementá-la e tratar os eventos em `/api/billing/webhook`
(passo a passo no comentário de `src/server/billing/billing-provider.ts`).

## Modelo de dados (principais tabelas)

| Tabela                    | Função                                                             |
| ------------------------- | ------------------------------------------------------------------ |
| `organizations`           | Tenant: plano, configurações de IA e human takeover                 |
| `organization_members`    | Usuário ↔ organização com papel                                     |
| `organization_invitations`| Convites por link (7 dias)                                          |
| `instagram_accounts`      | Contas conectadas (token criptografado)                             |
| `contacts`                | Pessoas que interagiram (IGSID), com `last_inbound_at` (janela 24h) |
| `tags`, `contact_tags`    | Etiquetas                                                           |
| `segments`                | Regras dinâmicas avaliadas por `contacts_in_segment()`              |
| `conversations`, `messages` | Caixa de entrada (Realtime)                                       |
| `comments`                | Comentários recebidos                                               |
| `automations`             | Gatilho + fluxo (JSON)                                              |
| `automation_runs`         | Estado de cada execução (aguardando delay/clique, concluída, falha) |
| `scheduled_jobs`          | Fila persistente                                                    |
| `ai_prompts`              | Prompts configuráveis                                               |
| `logs`, `webhook_events`  | Observabilidade                                                     |
| `plans`                   | Planos e limites (Stripe-ready)                                     |
