-- Índices para as chaves estrangeiras apontadas pelos Advisors de performance
create index if not exists automations_created_by_idx on public.automations(created_by);
create index if not exists conversations_assigned_to_idx on public.conversations(assigned_to);
create index if not exists instagram_accounts_connected_by_idx on public.instagram_accounts(connected_by);
create index if not exists messages_sent_by_idx on public.messages(sent_by);
create index if not exists organization_invitations_invited_by_idx on public.organization_invitations(invited_by);
create index if not exists organizations_billing_owner_idx on public.organizations(billing_owner_id);
create index if not exists organizations_created_by_idx on public.organizations(created_by);
create index if not exists organizations_pending_plan_idx on public.organizations(pending_plan_id);
create index if not exists organizations_plan_idx on public.organizations(plan_id);
create index if not exists payments_plan_idx on public.payments(plan_id);
create index if not exists referrals_link_idx on public.referrals(link_id);
