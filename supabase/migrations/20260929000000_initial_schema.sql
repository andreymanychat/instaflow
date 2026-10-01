-- =============================================================================
-- InstaFlow — schema inicial (multi-tenant)
-- Cada linha de dado de negócio pertence a uma organização (organization_id).
-- O isolamento entre clientes é garantido por Row Level Security (RLS).
-- O backend (webhooks, cron) usa a service_role e ignora RLS de forma controlada.
-- =============================================================================

-- Tokens aleatórios usam gen_random_uuid() (nativo do Postgres 13+), evitando
-- depender do pgcrypto, que no Supabase fica no schema "extensions".

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.account_status as enum ('active', 'expired', 'revoked', 'error');
create type public.automation_status as enum ('draft', 'active', 'paused');
create type public.trigger_type as enum ('comment', 'dm_keyword', 'story_reply', 'default_reply');
create type public.conversation_status as enum ('open', 'closed');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_source as enum ('contact', 'automation', 'ai', 'agent', 'comment_reply');
create type public.run_status as enum ('running', 'waiting_delay', 'waiting_input', 'completed', 'failed', 'cancelled');
create type public.job_status as enum ('pending', 'processing', 'done', 'failed');
create type public.log_level as enum ('debug', 'info', 'warn', 'error');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'incomplete');

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Planos (estrutura pronta para Stripe)
-- -----------------------------------------------------------------------------
create table public.plans (
  id text primary key,
  name text not null,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'brl',
  interval text not null default 'month',
  stripe_price_id text,
  limits jsonb not null default '{}'::jsonb,
  features text[] not null default '{}',
  sort_order integer not null default 0,
  is_active boolean not null default true
);

insert into public.plans (id, name, description, price_cents, limits, features, sort_order) values
  ('free', 'Free', 'Para começar a automatizar', 0,
    '{"instagram_accounts":1,"contacts":1000,"active_automations":3,"ai_replies_per_month":100,"members":2}',
    array['1 conta do Instagram','Até 1.000 contatos','3 automações ativas','100 respostas de IA/mês'], 1),
  ('pro', 'Pro', 'Para criadores e pequenos negócios', 9700,
    '{"instagram_accounts":3,"contacts":25000,"active_automations":50,"ai_replies_per_month":5000,"members":5}',
    array['3 contas do Instagram','Até 25.000 contatos','50 automações ativas','5.000 respostas de IA/mês','Segmentação avançada'], 2),
  ('business', 'Business', 'Para agências e operações maiores', 29700,
    '{"instagram_accounts":15,"contacts":250000,"active_automations":-1,"ai_replies_per_month":50000,"members":25}',
    array['15 contas do Instagram','Até 250.000 contatos','Automações ilimitadas','50.000 respostas de IA/mês','Suporte prioritário'], 3);

-- -----------------------------------------------------------------------------
-- Organizações e membros
-- -----------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique,
  plan_id text not null default 'free' references public.plans(id),
  subscription_status public.subscription_status not null default 'active',
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  ai_auto_reply_enabled boolean not null default false,
  default_ai_prompt_id uuid,
  human_takeover_minutes integer not null default 60 check (human_takeover_minutes between 0 and 10080),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- referencia profiles (1:1 com auth.users) para permitir join membro -> perfil na API
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_members_user_idx on public.organization_members(user_id);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.member_role not null default 'member' check (role <> 'owner'),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index organization_invitations_org_idx on public.organization_invitations(organization_id);
create index organization_invitations_email_idx on public.organization_invitations(lower(email));

-- Cria o profile automaticamente quando um usuário se cadastra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers de autorização usados nas políticas RLS.
-- SECURITY DEFINER evita recursão de RLS em organization_members.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(org_id uuid, roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.role = any(roles)
  );
$$;

-- Cria organização + membro owner atomicamente
create or replace function public.create_organization(org_name text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org public.organizations;
  base_slug text;
begin
  if (select auth.uid()) is null then
    raise exception 'not authenticated';
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(org_name), '[^a-z0-9]+', '-', 'g'));
  if base_slug = '' then base_slug := 'org'; end if;

  insert into public.organizations (name, slug, created_by)
  values (org_name, base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6), (select auth.uid()))
  returning * into new_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_org.id, (select auth.uid()), 'owner');

  return new_org;
end;
$$;

-- Aceita convite pendente que bate com o email do usuário logado
create or replace function public.accept_invitation(invite_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.organization_invitations;
  user_email text;
begin
  select email into user_email from auth.users where id = (select auth.uid());
  if user_email is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.organization_invitations
  where token = invite_token and accepted_at is null and expires_at > now();

  if inv.id is null then
    raise exception 'invitation not found or expired';
  end if;
  if lower(inv.email) <> lower(user_email) then
    raise exception 'invitation belongs to another email';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (inv.organization_id, (select auth.uid()), inv.role)
  on conflict (organization_id, user_id) do nothing;

  update public.organization_invitations set accepted_at = now() where id = inv.id;
  return inv.organization_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Contas do Instagram
-- -----------------------------------------------------------------------------
create table public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ig_user_id text not null unique,            -- ID profissional (usado nos webhooks: entry.id)
  ig_app_scoped_id text,                      -- ID retornado na troca do token OAuth
  username text not null,
  name text,
  profile_picture_url text,
  followers_count integer,
  access_token_encrypted text not null,       -- AES-256-GCM, nunca exposto ao cliente
  token_expires_at timestamptz,
  status public.account_status not null default 'active',
  webhook_subscribed boolean not null default false,
  connected_by uuid references auth.users(id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index instagram_accounts_org_idx on public.instagram_accounts(organization_id);
create trigger instagram_accounts_updated_at before update on public.instagram_accounts
  for each row execute function public.set_updated_at();

-- View segura sem o token, usada pelo frontend
create view public.instagram_accounts_public
with (security_invoker = true) as
  select id, organization_id, ig_user_id, username, name, profile_picture_url, followers_count,
         token_expires_at, status, webhook_subscribed, last_error, created_at, updated_at
  from public.instagram_accounts;

-- -----------------------------------------------------------------------------
-- Contatos, tags e segmentos
-- -----------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  igsid text not null,                        -- Instagram-scoped ID do usuário
  username text,
  name text,
  profile_pic_url text,
  follower_count integer,
  is_follower boolean,
  custom_fields jsonb not null default '{}'::jsonb,
  last_inbound_at timestamptz,                -- controla a janela de 24h da Meta
  last_interaction_at timestamptz not null default now(),
  subscribed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instagram_account_id, igsid)
);
create index contacts_org_idx on public.contacts(organization_id, last_interaction_at desc);
create index contacts_username_idx on public.contacts(organization_id, lower(username));
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 50),
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.contact_tags (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (contact_id, tag_id)
);
create index contact_tags_tag_idx on public.contact_tags(tag_id);
create index contact_tags_org_idx on public.contact_tags(organization_id);

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  -- { "match": "all"|"any", "rules": [{ "field": "tag", "operator": "has", "value": "<tag_id>" }, ...] }
  filters jsonb not null default '{"match":"all","rules":[]}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index segments_org_idx on public.segments(organization_id);
create trigger segments_updated_at before update on public.segments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Conversas e mensagens (Caixa de entrada)
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status public.conversation_status not null default 'open',
  assigned_to uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  unread_count integer not null default 0,
  ai_enabled boolean not null default true,
  bot_paused_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (instagram_account_id, contact_id)
);
create index conversations_org_idx on public.conversations(organization_id, last_message_at desc);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  direction public.message_direction not null,
  source public.message_source not null,
  mid text,                                   -- ID da mensagem na Meta (idempotência)
  text text,
  payload jsonb not null default '{}'::jsonb,
  automation_id uuid,
  sent_by uuid references auth.users(id) on delete set null,
  error text,
  created_at timestamptz not null default now()
);
create unique index messages_mid_idx on public.messages(mid) where mid is not null;
create index messages_conversation_idx on public.messages(conversation_id, created_at);
create index messages_org_created_idx on public.messages(organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Comentários recebidos
-- -----------------------------------------------------------------------------
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  instagram_account_id uuid not null references public.instagram_accounts(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  comment_id text not null unique,
  parent_id text,
  media_id text,
  media_product_type text,
  text text,
  replied boolean not null default false,
  private_replied boolean not null default false,
  created_at timestamptz not null default now()
);
create index comments_org_idx on public.comments(organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- IA: prompts configuráveis
-- -----------------------------------------------------------------------------
create table public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  system_prompt text not null,
  model text not null default 'gpt-5-mini',
  temperature numeric(3,2) not null default 0.7 check (temperature between 0 and 2),
  max_output_tokens integer not null default 400 check (max_output_tokens between 50 and 4000),
  history_limit integer not null default 12 check (history_limit between 0 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_prompts_org_idx on public.ai_prompts(organization_id);
create trigger ai_prompts_updated_at before update on public.ai_prompts
  for each row execute function public.set_updated_at();

alter table public.organizations
  add constraint organizations_default_ai_prompt_fk
  foreign key (default_ai_prompt_id) references public.ai_prompts(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Automações (fluxos visuais)
-- -----------------------------------------------------------------------------
create table public.automations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  instagram_account_id uuid references public.instagram_accounts(id) on delete cascade, -- null = todas as contas
  name text not null,
  description text,
  status public.automation_status not null default 'draft',
  trigger_type public.trigger_type not null,
  -- { "keywords": [...], "match": "contains"|"exact"|"starts_with"|"any", "media_ids": [...],
  --   "public_replies": [...], "only_first_comment": bool }
  trigger_config jsonb not null default '{}'::jsonb,
  -- { "nodes": [...], "edges": [...] } no formato React Flow
  flow jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  priority integer not null default 0,
  runs_count integer not null default 0,
  last_run_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index automations_lookup_idx on public.automations(organization_id, trigger_type, status);
create trigger automations_updated_at before update on public.automations
  for each row execute function public.set_updated_at();

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  automation_id uuid not null references public.automations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  status public.run_status not null default 'running',
  current_node_id text,
  context jsonb not null default '{}'::jsonb,
  steps_executed integer not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create index automation_runs_org_idx on public.automation_runs(organization_id, started_at desc);
create index automation_runs_waiting_idx on public.automation_runs(contact_id, status) where status = 'waiting_input';
create trigger automation_runs_updated_at before update on public.automation_runs
  for each row execute function public.set_updated_at();

create or replace function public.increment_automation_runs(automation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.automations
  set runs_count = runs_count + 1, last_run_at = now()
  where id = automation;
$$;

-- -----------------------------------------------------------------------------
-- Fila de jobs (delays, retomada de fluxos, refresh de tokens)
-- -----------------------------------------------------------------------------
create table public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  run_at timestamptz not null default now(),
  status public.job_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scheduled_jobs_due_idx on public.scheduled_jobs(run_at) where status = 'pending';
create trigger scheduled_jobs_updated_at before update on public.scheduled_jobs
  for each row execute function public.set_updated_at();

-- Reserva atomicamente jobs vencidos (FOR UPDATE SKIP LOCKED permite vários workers)
create or replace function public.claim_due_jobs(batch_size integer default 25)
returns setof public.scheduled_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Libera jobs travados há mais de 5 minutos (worker morreu no meio)
  update public.scheduled_jobs
  set status = 'pending', locked_at = null
  where status = 'processing' and locked_at < now() - interval '5 minutes';

  return query
  update public.scheduled_jobs j
  set status = 'processing', locked_at = now(), attempts = j.attempts + 1
  where j.id in (
    select id from public.scheduled_jobs
    where status = 'pending' and run_at <= now()
    order by run_at
    limit batch_size
    for update skip locked
  )
  returning j.*;
end;
$$;

-- -----------------------------------------------------------------------------
-- Logs e eventos brutos de webhook
-- -----------------------------------------------------------------------------
create table public.logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  level public.log_level not null default 'info',
  source text not null,
  event text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index logs_org_idx on public.logs(organization_id, created_at desc);

create table public.webhook_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  object text,
  ig_user_id text,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
create index webhook_events_created_idx on public.webhook_events(created_at desc);

-- Pedidos de exclusão de dados (callback obrigatório da Meta)
create table public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  confirmation_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  ig_user_id text not null,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Segmentação: avalia as regras do segmento direto no banco
-- regra: { "field": "tag"|"is_follower"|"last_interaction"|"instagram_account"|"username",
--          "operator": "has"|"not_has"|"is_true"|"is_false"|"within_days"|"older_than_days"|"equals"|"contains",
--          "value": "..." }
-- -----------------------------------------------------------------------------
create or replace function public.contact_matches_rule(c public.contacts, r jsonb)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case r->>'field'
    when 'tag' then
      exists (select 1 from public.contact_tags ct where ct.contact_id = c.id and ct.tag_id::text = r->>'value')
        = (r->>'operator' = 'has')
    when 'is_follower' then
      coalesce(c.is_follower, false) = (r->>'operator' = 'is_true')
    when 'last_interaction' then
      case r->>'operator'
        when 'within_days' then c.last_interaction_at > now() - make_interval(days => coalesce((r->>'value')::int, 0))
        else c.last_interaction_at <= now() - make_interval(days => coalesce((r->>'value')::int, 0))
      end
    when 'instagram_account' then c.instagram_account_id::text = r->>'value'
    when 'username' then
      case r->>'operator'
        when 'equals' then lower(coalesce(c.username, '')) = lower(r->>'value')
        else coalesce(c.username, '') ilike '%' || (r->>'value') || '%'
      end
    else true
  end;
$$;

create or replace function public.contacts_in_segment(org uuid, filters jsonb)
returns setof public.contacts
language sql
stable
security invoker
set search_path = ''
as $$
  select c.* from public.contacts c
  where c.organization_id = org
    and case
      when jsonb_array_length(coalesce(filters->'rules', '[]'::jsonb)) = 0 then true
      when filters->>'match' = 'any' then exists (
        select 1 from jsonb_array_elements(filters->'rules') r where public.contact_matches_rule(c, r)
      )
      else not exists (
        select 1 from jsonb_array_elements(filters->'rules') r where not public.contact_matches_rule(c, r)
      )
    end;
$$;

-- -----------------------------------------------------------------------------
-- Estatísticas do dashboard
-- -----------------------------------------------------------------------------
create or replace function public.dashboard_stats(org uuid)
returns json
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  result json;
begin
  select json_build_object(
    'contacts', (select count(*) from public.contacts where organization_id = org),
    'new_contacts_7d', (select count(*) from public.contacts where organization_id = org and created_at > now() - interval '7 days'),
    'messages_in_7d', (select count(*) from public.messages where organization_id = org and direction = 'inbound' and created_at > now() - interval '7 days'),
    'messages_out_7d', (select count(*) from public.messages where organization_id = org and direction = 'outbound' and created_at > now() - interval '7 days'),
    'ai_replies_30d', (select count(*) from public.messages where organization_id = org and source = 'ai' and created_at > now() - interval '30 days'),
    'active_automations', (select count(*) from public.automations where organization_id = org and status = 'active'),
    'runs_7d', (select count(*) from public.automation_runs where organization_id = org and started_at > now() - interval '7 days'),
    'comments_7d', (select count(*) from public.comments where organization_id = org and created_at > now() - interval '7 days'),
    'open_conversations', (select count(*) from public.conversations where organization_id = org and status = 'open'),
    'daily', (
      select coalesce(json_agg(d order by d.day), '[]'::json) from (
        select gs::date as day,
          (select count(*) from public.messages m where m.organization_id = org and m.direction = 'inbound' and m.created_at::date = gs::date) as inbound,
          (select count(*) from public.messages m where m.organization_id = org and m.direction = 'outbound' and m.created_at::date = gs::date) as outbound
        from generate_series(current_date - 13, current_date, interval '1 day') gs
      ) d
    )
  ) into result;
  return result;
end;
$$;

-- =============================================================================
-- Grants (explícitos, para não depender da exposição automática da Data API)
-- =============================================================================
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.plans to anon;

-- Tokens nunca saem do servidor: authenticated só enxerga colunas não sensíveis.
-- (revogar apenas a coluna não basta enquanto existir o grant da tabela inteira)
revoke all on public.instagram_accounts from anon, authenticated;
grant select (id, organization_id, ig_user_id, username, name, profile_picture_url, followers_count,
              token_expires_at, status, webhook_subscribed, last_error, created_at, updated_at)
  on public.instagram_accounts to authenticated;
grant delete on public.instagram_accounts to authenticated;

-- Plano e cobrança só mudam pelo backend (futuro webhook do Stripe), nunca pelo cliente.
revoke insert, update on public.organizations from authenticated;
grant update (name, ai_auto_reply_enabled, default_ai_prompt_id, human_takeover_minutes)
  on public.organizations to authenticated;

-- Tabelas operacionais: apenas service_role escreve
revoke insert, update, delete on public.plans, public.logs, public.webhook_events, public.automation_runs,
  public.scheduled_jobs, public.data_deletion_requests, public.comments from authenticated;

-- Funções internas não podem ser chamadas pela API pública
revoke execute on function public.claim_due_jobs(integer) from public, anon, authenticated;
revoke execute on function public.increment_automation_runs(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_organization(text) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.claim_due_jobs(integer) to service_role;
grant execute on function public.increment_automation_runs(uuid) to service_role;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.plans enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.profiles enable row level security;
alter table public.instagram_accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.tags enable row level security;
alter table public.contact_tags enable row level security;
alter table public.segments enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.comments enable row level security;
alter table public.ai_prompts enable row level security;
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;
alter table public.scheduled_jobs enable row level security;
alter table public.logs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.data_deletion_requests enable row level security;

-- Planos: leitura pública
create policy "plans are readable" on public.plans for select using (true);

-- Organizações
create policy "members read org" on public.organizations
  for select to authenticated using (public.is_org_member(id));
create policy "admins update org" on public.organizations
  for update to authenticated using (public.has_org_role(id, array['owner','admin']::public.member_role[]));
create policy "owners delete org" on public.organizations
  for delete to authenticated using (public.has_org_role(id, array['owner']::public.member_role[]));

-- Membros: a linha do owner é imutável pela API e ninguém é promovido a owner
create policy "members read members" on public.organization_members
  for select to authenticated using (public.is_org_member(organization_id));
create policy "admins manage members" on public.organization_members
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]) and role <> 'owner')
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]) and role <> 'owner');
create policy "admins remove members or self leave" on public.organization_members
  for delete to authenticated using (
    role <> 'owner' and (
      public.has_org_role(organization_id, array['owner','admin']::public.member_role[])
      or user_id = (select auth.uid())
    )
  );

-- Convites
create policy "admins manage invitations" on public.organization_invitations
  for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

-- Profiles: o próprio usuário e colegas de organização
create policy "read own or teammates profile" on public.profiles
  for select to authenticated using (
    id = (select auth.uid())
    or exists (
      select 1 from public.organization_members a
      join public.organization_members b on a.organization_id = b.organization_id
      where a.user_id = (select auth.uid()) and b.user_id = profiles.id
    )
  );
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid()));

-- Contas do Instagram: leitura para membros, remoção para admins (tokens são gravados pelo backend)
create policy "members read ig accounts" on public.instagram_accounts
  for select to authenticated using (public.is_org_member(organization_id));
create policy "admins delete ig accounts" on public.instagram_accounts
  for delete to authenticated using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

-- Prompts de IA: membros leem, admins escrevem
create policy "members read prompts" on public.ai_prompts
  for select to authenticated using (public.is_org_member(organization_id));
create policy "admins write prompts" on public.ai_prompts
  for all to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));

-- Tabelas de negócio: CRUD completo para membros da organização
do $$
declare
  t text;
begin
  foreach t in array array['contacts','tags','contact_tags','segments','conversations','messages','automations']
  loop
    execute format(
      'create policy "members full access" on public.%I for all to authenticated
         using (public.is_org_member(organization_id))
         with check (public.is_org_member(organization_id))', t);
  end loop;
end;
$$;

-- Somente leitura para membros
create policy "members read comments" on public.comments
  for select to authenticated using (public.is_org_member(organization_id));
create policy "members read runs" on public.automation_runs
  for select to authenticated using (public.is_org_member(organization_id));
create policy "members read logs" on public.logs
  for select to authenticated using (public.is_org_member(organization_id));
create policy "members read webhook events" on public.webhook_events
  for select to authenticated using (public.is_org_member(organization_id));
-- scheduled_jobs e data_deletion_requests: apenas service_role (sem políticas)

-- =============================================================================
-- Realtime (Caixa de entrada ao vivo)
-- =============================================================================
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
