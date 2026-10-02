-- Colegas de organização podem ver nome/foto/email uns dos outros, mas nunca
-- CPF/CNPJ, telefone e endereço. Os dados cadastrais completos são lidos pelo
-- servidor (service_role) somente para o próprio usuário.
revoke select on public.profiles from authenticated;
grant select (id, full_name, avatar_url, email, created_at, updated_at) on public.profiles to authenticated;

-- No máximo uma cobrança de renovação ativa por organização e período (evita cobrança dupla
-- se duas execuções do agendador se sobrepuserem).
create unique index if not exists payments_one_renewal_per_period
  on public.payments(organization_id, due_date)
  where is_renewal and status in ('pending', 'paid');
