-- =============================================================================
-- Virada do Asaas: sandbox -> produção. Executar UMA VEZ, logo antes de trocar
-- ASAAS_API_KEY/ASAAS_ENVIRONMENT na Vercel.
--
-- IDs de cliente, tokens de cartão e cobranças do sandbox não existem na conta
-- de produção, e o saldo gerado por Pix de teste é dinheiro fictício. Este script
-- apaga só dados de cobrança — contas, organizações, contatos e automações ficam.
-- =============================================================================

begin;

-- Organizações que ganharam plano pago com pagamento de teste voltam ao Free
update public.organizations
set plan_id = 'free', subscription_status = 'active', current_period_end = null,
    cancel_at_period_end = false, pending_plan_id = null, billing_owner_id = created_by
where plan_id <> 'free' and not billing_exempt;

delete from public.payments;
delete from public.payment_methods;
delete from public.wallet_transactions;
delete from public.user_wallets;
delete from public.billing_events;
-- Indicações continuam valendo, mas o crédito de teste é desfeito
update public.referrals set status = 'pending', reward_cents = 0, rewarded_at = null where status <> 'pending';

-- Clientes do sandbox não existem em produção: serão recriados no primeiro pagamento
update public.profiles set asaas_customer_id = null where asaas_customer_id is not null;

commit;
