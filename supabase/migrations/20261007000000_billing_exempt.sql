-- Plano de cortesia permanente (sem cobrança): usado na organização do dono do sistema.
-- Organizações isentas nunca entram no agendador de renovação, não podem ser rebaixadas
-- por falta de pagamento e não passam pelo checkout. Só o service_role altera esta coluna
-- (authenticated não tem grant de UPDATE nela).
alter table public.organizations
  add column if not exists billing_exempt boolean not null default false;

update public.organizations
set plan_id = 'business',
    billing_exempt = true,
    subscription_status = 'active',
    current_period_end = null,
    cancel_at_period_end = false,
    pending_plan_id = null,
    billing_owner_id = coalesce(billing_owner_id, created_by)
where id = 'f86ff8e3-98e2-4e9d-836a-05331b1f9125';
