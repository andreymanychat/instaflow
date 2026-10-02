-- =============================================================================
-- Perfil completo (PF/PJ), planos definitivos, carteira de créditos,
-- cartões tokenizados (Asaas), pagamentos, indicações e avatares.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfil do usuário
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists person_type text check (person_type in ('pf', 'pj')),
  add column if not exists document text check (document ~ '^[0-9]{11}$|^[0-9]{14}$'),
  add column if not exists company_name text,
  add column if not exists phone text check (phone ~ '^[0-9]{10,11}$'),
  add column if not exists postal_code text check (postal_code ~ '^[0-9]{8}$'),
  add column if not exists street text,
  add column if not exists address_number text,
  add column if not exists complement text,
  add column if not exists district text,
  add column if not exists city text,
  add column if not exists state text check (state ~ '^[A-Z]{2}$'),
  add column if not exists asaas_customer_id text unique;

-- O usuário edita os próprios dados cadastrais, mas nunca o vínculo com o Asaas
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, person_type, document, company_name, phone, postal_code,
              street, address_number, complement, district, city, state)
  on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Planos definitivos
-- -----------------------------------------------------------------------------
update public.plans set
  description = 'Para começar a automatizar',
  price_cents = 0,
  limits = '{"instagram_accounts":1,"contacts":500,"active_automations":1,"ai_replies_per_month":20,"members":1,"advanced_segmentation":false}',
  features = array['1 conta do Instagram','Até 500 contatos','1 automação ativa','20 respostas de IA/mês']
where id = 'free';

update public.plans set
  description = 'Para criadores e pequenos negócios',
  price_cents = 5700,
  limits = '{"instagram_accounts":2,"contacts":1000,"active_automations":5,"ai_replies_per_month":200,"members":3,"advanced_segmentation":true}',
  features = array['2 contas do Instagram','Até 1.000 contatos','5 automações ativas','200 respostas de IA/mês','Segmentação avançada']
where id = 'pro';

update public.plans set
  description = 'Para agências e operações maiores',
  price_cents = 9700,
  limits = '{"instagram_accounts":5,"contacts":50000,"active_automations":-1,"ai_replies_per_month":50000,"members":10,"advanced_segmentation":true}',
  features = array['5 contas do Instagram','Até 50.000 contatos','Automações ilimitadas','50.000 respostas de IA/mês','Segmentação avançada','Suporte prioritário']
where id = 'business';

-- -----------------------------------------------------------------------------
-- Assinatura da organização
-- -----------------------------------------------------------------------------
alter table public.organizations
  add column if not exists billing_owner_id uuid references public.profiles(id) on delete set null,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists pending_plan_id text references public.plans(id);

update public.organizations set billing_owner_id = created_by where billing_owner_id is null;

-- -----------------------------------------------------------------------------
-- Carteira de créditos (por usuário) — indicações e recargas via Pix
-- -----------------------------------------------------------------------------
create table public.user_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance_cents integer not null default 0 check (balance_cents >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents <> 0),
  balance_after_cents integer not null,
  kind text not null check (kind in ('referral_bonus', 'pix_topup', 'subscription_debit', 'adjustment')),
  description text not null,
  reference text,
  created_at timestamptz not null default now()
);
create index wallet_transactions_user_idx on public.wallet_transactions(user_id, created_at desc);
create unique index wallet_transactions_reference_idx on public.wallet_transactions(kind, reference) where reference is not null;

-- Movimenta a carteira de forma atômica (lock na linha) e idempotente por (kind, reference).
create or replace function public.wallet_apply(p_user uuid, p_amount integer, p_kind text, p_description text, p_reference text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo_saldo integer;
begin
  if p_reference is not null and exists (
    select 1 from public.wallet_transactions where kind = p_kind and reference = p_reference
  ) then
    select balance_cents into novo_saldo from public.user_wallets where user_id = p_user;
    return coalesce(novo_saldo, 0);
  end if;

  insert into public.user_wallets (user_id) values (p_user) on conflict (user_id) do nothing;

  update public.user_wallets
  set balance_cents = balance_cents + p_amount, updated_at = now()
  where user_id = p_user
  returning balance_cents into novo_saldo;

  if novo_saldo < 0 then
    raise exception 'saldo insuficiente';
  end if;

  insert into public.wallet_transactions (user_id, amount_cents, balance_after_cents, kind, description, reference)
  values (p_user, p_amount, novo_saldo, p_kind, p_description, p_reference);

  return novo_saldo;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cartões tokenizados (o número do cartão nunca é armazenado)
-- -----------------------------------------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'asaas',
  token text not null,
  brand text,
  last4 text,
  holder_name text,
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);
create index payment_methods_user_idx on public.payment_methods(user_id);

-- -----------------------------------------------------------------------------
-- Pagamentos (assinaturas e recargas)
-- -----------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  provider text not null default 'asaas',
  provider_payment_id text unique,
  kind text not null check (kind in ('subscription', 'topup')),
  plan_id text references public.plans(id),
  is_renewal boolean not null default false,
  amount_cents integer not null check (amount_cents >= 0),
  wallet_used_cents integer not null default 0 check (wallet_used_cents >= 0),
  method text not null check (method in ('pix', 'card', 'wallet')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'canceled')),
  pix_payload text,
  pix_qr_image text,
  pix_expires_at timestamptz,
  invoice_url text,
  due_date date,
  paid_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_idx on public.payments(user_id, created_at desc);
create index payments_org_idx on public.payments(organization_id, created_at desc);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- Eventos brutos do Asaas (idempotência: o id do evento é único)
create table public.billing_events (
  id text primary key,
  event text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Indique e ganhe
-- -----------------------------------------------------------------------------
create table public.referral_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  expires_at timestamptz not null default now() + interval '3 days',
  created_at timestamptz not null default now()
);
create index referral_links_user_idx on public.referral_links(user_id, created_at desc);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  link_id uuid references public.referral_links(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'rewarded', 'ineligible')),
  reward_cents integer not null default 0,
  rewarded_at timestamptz,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);
create index referrals_referrer_idx on public.referrals(referrer_id, created_at desc);

-- Convites de equipe passam a expirar em 3 dias
alter table public.organization_invitations alter column expires_at set default now() + interval '3 days';

-- -----------------------------------------------------------------------------
-- RLS e permissões
-- -----------------------------------------------------------------------------
alter table public.user_wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;
alter table public.billing_events enable row level security;
alter table public.referral_links enable row level security;
alter table public.referrals enable row level security;

create policy "own wallet" on public.user_wallets for select to authenticated using (user_id = (select auth.uid()));
create policy "own wallet transactions" on public.wallet_transactions for select to authenticated using (user_id = (select auth.uid()));
create policy "own payment methods" on public.payment_methods for select to authenticated using (user_id = (select auth.uid()));
create policy "own payments" on public.payments for select to authenticated using (user_id = (select auth.uid()));
create policy "own referral links" on public.referral_links for select to authenticated using (user_id = (select auth.uid()));
create policy "own referrals" on public.referrals for select to authenticated using (referrer_id = (select auth.uid()));
-- billing_events: somente service_role

grant select on public.user_wallets, public.wallet_transactions, public.payments, public.referral_links, public.referrals to authenticated;
-- O token do cartão nunca vai para o navegador
grant select (id, user_id, provider, brand, last4, holder_name, is_default, created_at) on public.payment_methods to authenticated;
grant all on public.user_wallets, public.wallet_transactions, public.payment_methods, public.payments,
  public.billing_events, public.referral_links, public.referrals to service_role;

revoke execute on function public.wallet_apply(uuid, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.wallet_apply(uuid, integer, text, text, text) to service_role;

-- -----------------------------------------------------------------------------
-- Fotos de perfil (Supabase Storage)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'];

create policy "avatars: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: dono atualiza" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
