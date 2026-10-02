# ChatFlow

Plataforma SaaS de automação para Instagram (alternativa ao ManyChat) construída **apenas com APIs oficiais da Meta**.
Multi-tenant, multiusuário, com construtor visual de fluxos, caixa de entrada em tempo real e IA (OpenAI).

| Camada        | Tecnologia                                                                 |
| ------------- | -------------------------------------------------------------------------- |
| Frontend      | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Shadcn/UI   |
| Fluxos        | React Flow (`@xyflow/react` 12)                                            |
| Backend       | Next.js Route Handlers + Server Actions                                    |
| Banco / Auth  | Supabase (PostgreSQL 15+, RLS, Realtime, Auth, pg_cron)                    |
| Integrações   | Instagram API com login do Instagram (Graph API v23), Webhooks, OAuth      |
| IA            | OpenAI (Responses API)                                                     |
| Hospedagem    | Vercel (Hobby) — região `gru1` (São Paulo)                                 |

## Funcionalidades

- **Contas**: cadastro, login, recuperação de senha, múltiplas organizações por usuário, convites com papéis (owner/admin/member)
- **Instagram**: conexão via OAuth oficial, token de 60 dias criptografado (AES-256-GCM) e renovado automaticamente, callbacks de desautorização e exclusão de dados
- **Webhooks**: validação `X-Hub-Signature-256`, resposta imediata e processamento assíncrono (`after()`), idempotência por `mid`/`comment_id`
- **Automações** (construtor visual): gatilhos de comentário (por post ou todos), palavra-chave no Direct, resposta a story e resposta padrão
  - Passos: enviar mensagem (texto, respostas rápidas, botões de link), responder comentário publicamente (com variações), aguardar (delay), condição (tag, texto, segue o perfil, @usuário), adicionar/remover tag, resposta com IA
  - Variáveis `{{first_name}}`, `{{name}}`, `{{username}}`, `{{last_text}}`
- **Caixa de entrada** em tempo real (Supabase Realtime), histórico, sugestão de resposta por IA, pausa automática do bot quando um humano responde (human takeover)
- **Contatos, tags e segmentos dinâmicos** (avaliados no Postgres)
- **IA**: prompts configuráveis, prompt padrão, resposta automática, playground de testes, cota por plano
- **Logs**: eventos, execuções de automações e webhooks brutos
- **Assinatura com Asaas**: Free / Pro (R$ 57) / Business (R$ 97), cartão de crédito e Pix, renovação automática, carteira de créditos (recarga via Pix) e "Indique e ganhe" (R$ 10 por indicação) — veja [docs/PAGAMENTOS.md](docs/PAGAMENTOS.md)
- **Minha conta**: perfil PF/PJ com CPF/CNPJ validado, endereço com busca por CEP, foto, e exclusão completa da conta
- **Tema claro/escuro** (ou seguir o sistema)

## Início rápido (local)

```bash
cd instaflow
npm install
cp .env.example .env.local   # preencha os valores (veja docs/GUIA-DE-DEPLOY.md)
npm run dev                  # http://localhost:3000
```

Antes, rode a migração `supabase/migrations/20260929000000_initial_schema.sql` no SQL Editor do Supabase.

## Scripts

| Comando             | O que faz                                                                    |
| ------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento                                                   |
| `npm run build`     | Build de produção                                                             |
| `npm run typecheck` | Gera os tipos de rota e roda o TypeScript                                     |
| `npm run lint`      | ESLint (inclui regras do React Compiler)                                      |
| `npm test`          | Testes unitários (matcher de palavras-chave, templates, JSON seguro)          |
| `npm run test:db`   | Aplica a migração num Postgres embutido e testa RLS/multi-tenant (26 checks)  |
| `npm run simulate`  | Envia webhooks assinados falsos para testar fluxos sem a Meta                 |

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md) — decisões de arquitetura e estrutura de pastas
- [docs/GUIA-DE-DEPLOY.md](docs/GUIA-DE-DEPLOY.md) — Gmail, GitHub, Supabase, Vercel e Meta Developer passo a passo
- [docs/TESTES.md](docs/TESTES.md) — como testar cada funcionalidade

## Estrutura

```
instaflow/
├── supabase/
│   ├── migrations/20260929000000_initial_schema.sql   # schema, RLS, funções, grants
│   └── cron.sql                                        # agendador (pg_cron) — rodar após o deploy
├── scripts/simulate-webhook.mjs                        # simulador de webhooks assinados
├── tests/                                              # testes unitários e de banco
└── src/
    ├── proxy.ts                     # sessão Supabase + proteção de rotas (antigo middleware)
    ├── app/
    │   ├── (auth)/                  # login, signup, forgot-password
    │   ├── (app)/                   # área logada: dashboard, inbox, automations, contacts,
    │   │                            #   segments, ai, logs, settings, billing
    │   ├── api/
    │   │   ├── webhook/             # GET verificação + POST eventos da Meta
    │   │   ├── oauth/               # connect, callback, deauthorize, data-deletion
    │   │   ├── cron/                # process-jobs, refresh-tokens
    │   │   ├── instagram/media/     # posts para o gatilho de comentário
    │   │   ├── billing/webhook/     # webhook do Asaas
    │   │   └── health/              # diagnóstico de configuração
    │   ├── auth/callback/           # confirmação de email / reset de senha
    │   ├── onboarding/ invite/ reset-password/
    │   └── privacidade/ termos/ exclusao-de-dados/   # páginas exigidas pela Meta
    ├── components/                  # UI (ui/ = Shadcn) e componentes por domínio
    ├── hooks/
    ├── lib/                         # env, crypto, supabase clients, utils
    ├── server/
    │   ├── actions/                 # Server Actions (mutações da UI, validadas com Zod)
    │   ├── auth/                    # sessão, organização ativa, cron auth
    │   ├── engine/                  # motor de fluxos: grafo, executores, gatilhos
    │   ├── integrations/            # clientes Instagram Graph API e OpenAI
    │   ├── services/                # webhook, mensagens, contatos, IA, fila, planos, logs
    │   └── billing/                 # cobrança Asaas, carteira, renovação e indicações
    └── types/                       # tipos do banco e do modelo de fluxo
```
