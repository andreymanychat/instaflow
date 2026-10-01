# Guia de deploy — do zero ao ar

Tudo nos planos gratuitos, sem cartão de crédito. Siga na ordem.
Substitua `seuprojeto.vercel.app` pela URL real que a Vercel gerar.

---

## 1. Gmail dedicado

1. Crie em <https://accounts.google.com/signup> (ex.: `meuchat.projeto@gmail.com`).
2. Ative a verificação em 2 etapas (Conta Google → Segurança).
3. Guarde tudo em um gerenciador de senhas. Use este email em todas as contas abaixo.

## 2. GitHub

1. Crie a conta em <https://github.com/signup> com o Gmail novo (plano Free).
2. Crie um repositório **privado** vazio (sem README, .gitignore ou licença), ex.: `instaflow`.
3. No seu computador, dentro da pasta `instaflow/`:

```bash
git init
git add .
git commit -m "InstaFlow: versão inicial"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/instaflow.git
git push -u origin main
```

> O `.gitignore` já impede o envio de `.env.local`. Nunca faça commit de chaves.

## 3. Supabase (banco de dados + autenticação)

### 3.1 Criar o projeto
1. <https://supabase.com> → **Start your project** → login com o Gmail.
2. **New Project**: nome do projeto, senha forte do banco (anote), região **South America (São Paulo)**, plano **Free**.
3. Aguarde ~2 minutos.

### 3.2 Criar as tabelas
1. Menu **SQL Editor** → **New query**.
2. Cole todo o conteúdo de `supabase/migrations/20260929000000_initial_schema.sql` → **Run**.
3. Confira em **Table Editor**: devem aparecer `organizations`, `automations`, `contacts`, `plans` etc.

> Alternativa via CLI: `npx supabase login`, `npx supabase init`, `npx supabase link --project-ref <ref>` e `npx supabase db push`.

### 3.3 Anotar as chaves (Project Settings → API / API Keys)
| Onde no Supabase                         | Variável                          |
| ---------------------------------------- | --------------------------------- |
| Project URL                              | `NEXT_PUBLIC_SUPABASE_URL`        |
| `anon` / publishable key                 | `NEXT_PUBLIC_SUPABASE_ANON_KEY`   |
| `service_role` / secret key (**secreta**) | `SUPABASE_SERVICE_ROLE_KEY`       |

### 3.4 Configurar URLs de autenticação
**Authentication → URL Configuration**:
- **Site URL**: `https://seuprojeto.vercel.app`
- **Redirect URLs** (adicione as duas):
  - `https://seuprojeto.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

> Opcional para testes rápidos: em **Authentication → Sign In / Providers → Email**, desative "Confirm email"
> para entrar sem confirmar o email. Em produção, deixe ativado.
> O envio de email do plano grátis tem limite baixo por hora; para produção configure um SMTP próprio
> (Authentication → Emails → SMTP Settings).

## 4. Gerar os segredos

Rode três vezes e anote cada resultado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

| Uso                                   | Variável                     |
| ------------------------------------- | ---------------------------- |
| Chave de criptografia dos tokens      | `TOKEN_ENCRYPTION_KEY` (64 hex) |
| Token de verificação do webhook       | `META_WEBHOOK_VERIFY_TOKEN`  |
| Segredo do agendador                  | `CRON_SECRET`                |

> Não troque a `TOKEN_ENCRYPTION_KEY` depois: os tokens do Instagram já salvos deixariam de abrir.

## 5. Vercel (hospedagem)

1. <https://vercel.com/signup> → **Continue with GitHub** → autorize → plano **Hobby**.
2. **Add New → Project** → escolha o repositório.
3. **Root Directory**: se o repositório contém a pasta `instaflow/`, selecione-a; se você subiu o conteúdo
   da pasta direto na raiz, deixe `./`.
4. Em **Environment Variables**, cadastre (os valores do Instagram você preenche no passo 6 e faz redeploy):

```
NEXT_PUBLIC_APP_URL=https://seuprojeto.vercel.app
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
META_WEBHOOK_VERIFY_TOKEN=...
META_GRAPH_API_VERSION=v23.0
TOKEN_ENCRYPTION_KEY=...
CRON_SECRET=...
OPENAI_API_KEY=...            (opcional)
OPENAI_DEFAULT_MODEL=gpt-5-mini
```

5. **Deploy**. Anote a URL gerada (ex.: `seuprojeto.vercel.app`). Se ela for diferente do que você colocou em
   `NEXT_PUBLIC_APP_URL`, corrija a variável e faça **Redeploy** (Deployments → ⋯ → Redeploy).
6. Teste: `https://seuprojeto.vercel.app/api/health` deve responder `"ok": true` e listar as variáveis presentes.

### 5.1 Ativar o agendador (delays, retomada de fluxos, renovação de tokens)
1. Abra `supabase/cron.sql`, troque `https://SEU-PROJETO.vercel.app` pela sua URL e `SEU_CRON_SECRET` pelo valor do `CRON_SECRET`.
2. Cole no **SQL Editor** do Supabase → **Run**.
3. Verifique depois de 1–2 minutos: `select * from cron.job_run_details order by start_time desc limit 5;`
   e `select * from net._http_response order by created desc limit 5;` (status 200 esperado).

## 6. Meta Developer (Instagram)

### 6.1 Conta e modo desenvolvedor
1. Crie uma conta no Facebook com o Gmail novo (<https://www.facebook.com/signup>). A Meta pode pedir verificação de identidade.
2. <https://developers.facebook.com> → **Começar** → aceite os termos → categoria **Desenvolvedor**.

### 6.2 Criar o app
1. <https://developers.facebook.com/apps> → **Criar app**.
2. Nome do app e email de contato (Gmail novo).
3. Caso de uso: **Outro** → **Crie um app sem um caso de uso** → Tipo **Empresa**.
4. Portfólio: **Ainda não quero me conectar a um portfólio empresarial** → criar.
5. Anote o **ID do App**.

### 6.3 Caso de uso do Instagram
1. **Casos de uso** → **+ Adicionar casos de uso** → **Gerenciar mensagens e conteúdo no Instagram** → Adicionar → **Personalizar**.
2. **Seção 1 — permissões** (acesso padrão, status "Pronto para teste"):
   `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`.
3. No topo, anote **ID do app do Instagram** → `INSTAGRAM_APP_ID` e **Chave secreta do app do Instagram** → `INSTAGRAM_APP_SECRET`.
   Cadastre na Vercel e faça **Redeploy** antes do próximo passo.

### 6.4 Webhook (Seção 3)
1. **URL de callback**: `https://seuprojeto.vercel.app/api/webhook`
2. **Verificar token**: o valor de `META_WEBHOOK_VERIFY_TOKEN`
3. **Verificar e salvar** → check verde. (Se falhar: a variável não está na Vercel ou faltou redeploy.)
4. Na tabela de campos, clique **Assinar** em: **comments**, **messages** e **messaging_postbacks**.

> Sem `comments` o sistema nunca recebe comentários. Sem `messaging_postbacks` os botões de link+postback não retomam fluxos.

### 6.5 Login da empresa no Instagram (Seção 4)
- **URI de redirecionamento OAuth**: `https://seuprojeto.vercel.app/api/oauth/callback`
- **URI de desautorização**: `https://seuprojeto.vercel.app/api/oauth/deauthorize`
- **URI de exclusão de dados**: `https://seuprojeto.vercel.app/exclusao-de-dados`
  (a página mostra as instruções e o mesmo endereço aceita o POST da Meta — o `proxy.ts` o encaminha para `/api/oauth/data-deletion`).

Salvar → verde.

### 6.6 Testadores do Instagram
1. **Funções do app → Funções → Adicionar pessoas → Testador do Instagram** → digite o @ (sem @).
2. No celular do dono da conta: Instagram → Perfil → ≡ → **Configurações e privacidade → Apps e sites → Convites de testador → Aceitar**.
3. A conta precisa ser **profissional** (Business ou Creator) e em *Mensagens e respostas a stories → Ferramentas conectadas* permitir o acesso a mensagens.

> Limite do modo de teste: 25 contas testadoras. Para abrir ao público, é preciso passar pela **Análise do App** (Acesso Avançado às permissões).

### 6.7 Publicar em Modo Ao Vivo (crítico)
Em **Configurações do app → Básico**, preencha:
- Ícone 1024×1024 (pode usar <https://placehold.co/1024x1024>)
- URL da Política de Privacidade: `https://seuprojeto.vercel.app/privacidade`
- URL dos Termos de Serviço: `https://seuprojeto.vercel.app/termos`
- URL de exclusão de dados: `https://seuprojeto.vercel.app/exclusao-de-dados`
- Categoria: Utilitários ou Empresas e Páginas

Depois: **Publicar** → alterne **Modo Desenvolvimento → Modo Ao Vivo** → confirme → status **Publicado**.

> Em modo de desenvolvimento a Meta entrega apenas webhooks de mensagens; **comentários só chegam com o app publicado**.
> "Currently ineligible for submission" = falta algum campo em Configurações → Básico.

(Opcional) Copie também a **Chave secreta do aplicativo** (Configurações → Básico) para `META_APP_SECRET` na Vercel:
o sistema aceita qualquer uma das duas chaves ao validar as assinaturas dos webhooks.

## 7. Primeiro uso

1. Acesse `https://seuprojeto.vercel.app` → **Criar conta** → confirme o email → crie a organização.
2. **Configurações → Instagram → Conectar Instagram** → faça login com a conta testadora → autorize.
3. A conta aparece com "Recebendo eventos". Crie uma automação a partir de um modelo e ative.
4. Siga o roteiro em [TESTES.md](TESTES.md).

## 8. OpenAI (opcional)

1. <https://platform.openai.com/api-keys> → crie uma chave → `OPENAI_API_KEY` na Vercel → redeploy.
2. A API da OpenAI é paga por uso (não entra no "zero custo"). Sem a chave, o sistema funciona normalmente, só sem IA.

## 9. Domínio próprio (opcional)
Compre no Registro.br, adicione em Vercel → Project → Settings → Domains e siga as instruções de DNS.
Depois atualize `NEXT_PUBLIC_APP_URL`, as URLs no Supabase (3.4), no app da Meta (6.4, 6.5, 6.7) e no `cron.sql`.

## Solução de problemas

| Sintoma                                   | Causa provável / solução                                                         |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| "Verificar e salvar" do webhook falha     | `META_WEBHOOK_VERIFY_TOKEN` ausente/diferente na Vercel ou sem redeploy            |
| Logs mostram "assinatura inválida"        | `INSTAGRAM_APP_SECRET` errado; configure também `META_APP_SECRET`                  |
| DMs chegam, comentários não               | App não publicado (Modo Ao Vivo) ou campo `comments` não assinado                  |
| Nada chega                                | Conta não é testadora, não aceitou convite, ou "Sincronizar" em Config → Instagram |
| "Fora da janela de 24h"                   | Regra da Meta: o contato precisa ter enviado mensagem nas últimas 24h             |
| Delays longos não continuam               | `cron.sql` não executado ou `CRON_SECRET` diferente                               |
| Erro de redirect no login por email        | Redirect URLs do Supabase (passo 3.4)                                             |
