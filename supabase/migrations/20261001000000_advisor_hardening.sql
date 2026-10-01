-- =============================================================================
-- Ajustes apontados pelos Advisors do Supabase
-- =============================================================================

-- Helpers de RLS só fazem sentido para usuários logados
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.has_org_role(uuid, public.member_role[]) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.has_org_role(uuid, public.member_role[]) to authenticated, service_role;

-- Índices em chaves estrangeiras usadas em joins e em deletes em cascata
create index if not exists automation_runs_automation_idx on public.automation_runs(automation_id);
create index if not exists automation_runs_conversation_idx on public.automation_runs(conversation_id);
create index if not exists automations_instagram_account_idx on public.automations(instagram_account_id);
create index if not exists comments_contact_idx on public.comments(contact_id);
create index if not exists comments_instagram_account_idx on public.comments(instagram_account_id);
create index if not exists comments_contact_media_idx on public.comments(contact_id, media_id);
create index if not exists conversations_contact_idx on public.conversations(contact_id);
create index if not exists messages_contact_idx on public.messages(contact_id);
create index if not exists scheduled_jobs_organization_idx on public.scheduled_jobs(organization_id);
create index if not exists webhook_events_organization_idx on public.webhook_events(organization_id, created_at desc);
create index if not exists organizations_default_ai_prompt_idx on public.organizations(default_ai_prompt_id);

-- ai_prompts: uma política por ação (evita duas políticas permissivas no SELECT)
drop policy if exists "admins write prompts" on public.ai_prompts;
create policy "admins insert prompts" on public.ai_prompts
  for insert to authenticated
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));
create policy "admins update prompts" on public.ai_prompts
  for update to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]))
  with check (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));
create policy "admins delete prompts" on public.ai_prompts
  for delete to authenticated
  using (public.has_org_role(organization_id, array['owner','admin']::public.member_role[]));
