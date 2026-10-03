import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { missingProfileFields } from "@/lib/profile";
import * as asaas from "@/server/integrations/asaas/client";
import { errorMessage, log } from "@/server/services/logger";
import { handleInvoiceEvent, scheduleInvoiceForPayment } from "@/server/billing/invoice-service";
import {
  REFERRAL_REWARD_CENTS,
  RENEWAL_PIX_DAYS_BEFORE,
  nextPeriodEnd,
  splitWithWallet,
  toBrazilDate,
} from "@/server/billing/pricing";
import type { Tables } from "@/types/database";

/**
 * Cobrança com Asaas — regras de negócio:
 * - Assinatura é da organização; quem paga é o usuário (billing_owner_id).
 * - A carteira (créditos de indicação + recargas Pix) é do usuário e é usada primeiro.
 * - A diferença vai para o cartão salvo/novo ou para um Pix.
 * - Renovação: Pix gerado 3 dias antes (se não houver cartão nem saldo suficiente);
 *   saldo/cartão são cobrados no vencimento. Sem pagamento no vencimento → volta ao Free na hora.
 * - Toda confirmação é idempotente (webhook, polling e cobrança síncrona de cartão podem chegar juntos).
 */

type Payment = Tables<"payments">;
type Organization = Tables<"organizations">;

export class BillingError extends Error {}

const admin = () => createAdminClient();
const centsToReais = (cents: number) => Number((cents / 100).toFixed(2));

// ---- Leitura ----------------------------------------------------------------------

export async function getWalletBalance(userId: string) {
  const { data } = await admin().from("user_wallets").select("balance_cents").eq("user_id", userId).maybeSingle();
  return data?.balance_cents ?? 0;
}

async function getPlan(planId: string) {
  const { data } = await admin().from("plans").select("*").eq("id", planId).eq("is_active", true).maybeSingle();
  if (!data) throw new BillingError("Plano inválido.");
  return data;
}

async function getDefaultCard(userId: string) {
  const { data } = await admin()
    .from("payment_methods")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// ---- Cliente Asaas -------------------------------------------------------------------

export async function loadBillingProfile(userId: string) {
  const { data } = await admin().from("profiles").select("*").eq("id", userId).single();
  if (!data) throw new BillingError("Perfil não encontrado.");
  return data;
}

/** Garante o cliente no Asaas (exige cadastro completo: CPF/CNPJ, telefone e endereço). */
export async function ensureAsaasCustomer(userId: string) {
  const profile = await loadBillingProfile(userId);
  const missing = missingProfileFields(profile);
  if (missing.length) {
    throw new BillingError(`Complete seu cadastro em Minha conta antes de pagar (faltando: ${missing.join(", ")}).`);
  }
  if (profile.asaas_customer_id) return { customerId: profile.asaas_customer_id, profile };

  const customer = await asaas.createCustomer(customerPayload(profile));
  await admin().from("profiles").update({ asaas_customer_id: customer.id }).eq("id", userId);
  return { customerId: customer.id, profile };
}

export function customerPayload(profile: Tables<"profiles">): asaas.AsaasCustomerInput {
  const name = profile.person_type === "pj" && profile.company_name ? profile.company_name : profile.full_name!;
  return {
    name,
    cpfCnpj: profile.document!,
    email: profile.email!,
    mobilePhone: profile.phone!,
    postalCode: profile.postal_code!,
    address: profile.street!,
    addressNumber: profile.address_number!,
    complement: profile.complement ?? undefined,
    province: profile.district!,
    externalReference: profile.id,
  };
}

/** Mantém o cadastro do Asaas em dia quando o usuário edita o perfil. Falhas não bloqueiam a edição. */
export async function syncAsaasCustomer(userId: string) {
  try {
    const profile = await loadBillingProfile(userId);
    if (!profile.asaas_customer_id || missingProfileFields(profile).length) return;
    await asaas.updateCustomer(profile.asaas_customer_id, customerPayload(profile));
  } catch (error) {
    await log({ level: "warn", source: "billing", event: "customer_sync_failed", message: errorMessage(error) });
  }
}

// ---- Cartões -----------------------------------------------------------------------

export type NewCard = { holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string };

/** Tokeniza no Asaas e guarda apenas token, bandeira e final. */
export async function saveCard(userId: string, card: NewCard, remoteIp: string) {
  const { customerId, profile } = await ensureAsaasCustomer(userId);
  const result = await asaas.tokenizeCard({
    customer: customerId,
    creditCard: card,
    creditCardHolderInfo: {
      name: card.holderName,
      email: profile.email!,
      cpfCnpj: profile.document!,
      postalCode: profile.postal_code!,
      addressNumber: profile.address_number!,
      addressComplement: profile.complement ?? undefined,
      phone: profile.phone!,
      mobilePhone: profile.phone!,
    },
    remoteIp,
  });

  const db = admin();
  await db.from("payment_methods").update({ is_default: false }).eq("user_id", userId);
  const { data, error } = await db
    .from("payment_methods")
    .insert({
      user_id: userId,
      token: result.creditCardToken,
      brand: result.creditCardBrand,
      last4: result.creditCardNumber,
      holder_name: card.holderName,
      is_default: true,
    })
    .select("id, brand, last4")
    .single();
  if (error) throw error;
  return data;
}

// ---- Checkout ----------------------------------------------------------------------

export type CheckoutResult =
  | { status: "paid"; paymentId: string }
  | { status: "pending"; paymentId: string; pix?: { payload: string; image: string; expiresAt: string } }
  | { status: "failed"; paymentId: string; error: string };

type PayWith = { method: "pix" } | { method: "card"; cardId: string } | { method: "new_card"; card: NewCard };

export async function startSubscriptionCheckout(params: {
  userId: string;
  organization: Organization;
  planId: string;
  payWith: PayWith;
  remoteIp: string;
}): Promise<CheckoutResult> {
  const { userId, organization, planId, payWith, remoteIp } = params;
  const plan = await getPlan(planId);
  if (plan.price_cents <= 0) throw new BillingError("O plano Free não precisa de pagamento.");

  if (organization.billing_exempt) throw new BillingError("Esta organização tem plano cortesia permanente: não há o que pagar.");
  const active = organization.plan_id === planId && organization.current_period_end && new Date(organization.current_period_end) > new Date();
  if (active) throw new BillingError(`Esta organização já está no plano ${plan.name}.`);

  await cancelPendingCheckouts(organization.id);

  const { walletCents, chargeCents } = splitWithWallet(plan.price_cents, await getWalletBalance(userId));
  return createAndCharge({
    userId,
    organizationId: organization.id,
    kind: "subscription",
    planId,
    isRenewal: false,
    amountCents: plan.price_cents,
    walletCents,
    chargeCents,
    payWith,
    remoteIp,
    description: `ChatFlow — plano ${plan.name} (mensal)`,
    dueDate: toBrazilDate(new Date()),
  });
}

export async function startWalletTopUp(params: { userId: string; amountCents: number }): Promise<CheckoutResult> {
  return createAndCharge({
    userId: params.userId,
    organizationId: null,
    kind: "topup",
    planId: null,
    isRenewal: false,
    amountCents: params.amountCents,
    walletCents: 0,
    chargeCents: params.amountCents,
    payWith: { method: "pix" },
    remoteIp: "",
    description: `ChatFlow — recarga de créditos ${formatCurrency(params.amountCents)}`,
    dueDate: toBrazilDate(new Date()),
  });
}

/** Um novo checkout substitui Pix pendentes anteriores da mesma organização (evita pagar duas vezes). */
async function cancelPendingCheckouts(organizationId: string) {
  const db = admin();
  const { data: pending } = await db
    .from("payments")
    .select("id, provider_payment_id")
    .eq("organization_id", organizationId)
    .eq("kind", "subscription")
    .eq("is_renewal", false)
    .eq("status", "pending");
  for (const payment of pending ?? []) {
    if (payment.provider_payment_id) await asaas.deletePayment(payment.provider_payment_id).catch(() => undefined);
    await db.from("payments").update({ status: "canceled" }).eq("id", payment.id).eq("status", "pending");
  }
}

async function createAndCharge(input: {
  userId: string;
  organizationId: string | null;
  kind: Payment["kind"];
  planId: string | null;
  isRenewal: boolean;
  amountCents: number;
  walletCents: number;
  chargeCents: number;
  payWith: PayWith;
  remoteIp: string;
  description: string;
  dueDate: string;
}): Promise<CheckoutResult> {
  const db = admin();
  const method: Payment["method"] = input.chargeCents === 0 ? "wallet" : input.payWith.method === "pix" ? "pix" : "card";

  const { data: payment, error } = await db
    .from("payments")
    .insert({
      user_id: input.userId,
      organization_id: input.organizationId,
      kind: input.kind,
      plan_id: input.planId,
      is_renewal: input.isRenewal,
      amount_cents: input.amountCents,
      wallet_used_cents: input.walletCents,
      method,
      due_date: input.dueDate,
    })
    .select("*")
    .single();
  if (error) throw error;

  // Coberto 100% pelo saldo
  if (method === "wallet") {
    await confirmPayment(payment.id, "carteira");
    return { status: "paid", paymentId: payment.id };
  }

  // Cartão novo só fica salvo se a primeira cobrança passar (senão viraria o padrão das renovações)
  let newCardId: string | null = null;
  try {
    const { customerId } = await ensureAsaasCustomer(input.userId);

    if (method === "pix") {
      const charge = await asaas.createPayment({
        customer: customerId,
        billingType: "PIX",
        value: centsToReais(input.chargeCents),
        dueDate: input.dueDate,
        description: input.description,
        externalReference: payment.id,
      });
      const qr = await asaas.getPixQrCode(charge.id);
      await db
        .from("payments")
        .update({
          provider_payment_id: charge.id,
          invoice_url: charge.invoiceUrl ?? null,
          pix_payload: qr.payload,
          pix_qr_image: qr.encodedImage,
          pix_expires_at: new Date(qr.expirationDate.replace(" ", "T") + "-03:00").toISOString(),
        })
        .eq("id", payment.id);
      return {
        status: "pending",
        paymentId: payment.id,
        pix: { payload: qr.payload, image: qr.encodedImage, expiresAt: qr.expirationDate },
      };
    }

    // Cartão (salvo ou novo)
    let token: string;
    if (input.payWith.method === "new_card") {
      const saved = await saveCard(input.userId, input.payWith.card, input.remoteIp);
      newCardId = saved.id;
      token = (await db.from("payment_methods").select("token").eq("id", saved.id).single()).data!.token;
    } else {
      const cardId = input.payWith.method === "card" ? input.payWith.cardId : null;
      const { data: card } = await db
        .from("payment_methods")
        .select("token")
        .eq("id", cardId ?? "")
        .eq("user_id", input.userId)
        .maybeSingle();
      if (!card) throw new BillingError("Cartão não encontrado.");
      token = card.token;
    }

    const charge = await asaas.createPayment({
      customer: customerId,
      billingType: "CREDIT_CARD",
      value: centsToReais(input.chargeCents),
      dueDate: input.dueDate,
      description: input.description,
      externalReference: payment.id,
      creditCardToken: token,
      remoteIp: input.remoteIp || undefined,
    });
    await db
      .from("payments")
      .update({ provider_payment_id: charge.id, invoice_url: charge.invoiceUrl ?? null })
      .eq("id", payment.id);

    if (asaas.PAID_STATUSES.includes(charge.status)) {
      await confirmPayment(payment.id, "cartão");
      return { status: "paid", paymentId: payment.id };
    }
    // Ex.: AWAITING_RISK_ANALYSIS — o webhook confirma ou recusa depois
    return { status: "pending", paymentId: payment.id };
  } catch (error) {
    const message = error instanceof asaas.AsaasError || error instanceof BillingError ? error.message : "Falha ao processar o pagamento.";
    await db.from("payments").update({ status: "failed", failure_reason: message }).eq("id", payment.id).eq("status", "pending");
    if (newCardId) await discardCard(input.userId, newCardId);
    await log({
      organizationId: input.organizationId,
      level: "warn",
      source: "billing",
      event: "charge_failed",
      message: `Cobrança ${input.kind} falhou: ${message}`,
      metadata: { paymentId: payment.id },
    });
    return { status: "failed", paymentId: payment.id, error: message };
  }
}

/** Remove um cartão recusado e devolve o "padrão" ao cartão salvo mais recente. */
async function discardCard(userId: string, cardId: string) {
  const db = admin();
  await db.from("payment_methods").delete().eq("id", cardId).eq("user_id", userId);
  const { data: latest } = await db
    .from("payment_methods")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest) await db.from("payment_methods").update({ is_default: true }).eq("id", latest.id);
}

// ---- Confirmação / falha (idempotentes) --------------------------------------------------

export async function confirmPayment(paymentId: string, via: string) {
  const db = admin();
  // "Reserva" a confirmação: só uma chamada concorrente passa daqui.
  const { data: payment } = await db
    .from("payments")
    .update({ status: "paid", paid_at: new Date().toISOString(), failure_reason: null })
    .eq("id", paymentId)
    .in("status", ["pending", "failed", "canceled"])
    .select("*")
    .maybeSingle();
  if (!payment) return;

  if (payment.kind === "topup") {
    await db.rpc("wallet_apply", {
      p_user: payment.user_id,
      p_amount: payment.amount_cents,
      p_kind: "pix_topup",
      p_description: "Recarga via Pix",
      p_reference: `payment:${payment.id}`,
    });
    await log({ level: "info", source: "billing", event: "topup_paid", message: `Recarga de ${formatCurrency(payment.amount_cents)} creditada.` });
    await scheduleInvoiceForPayment(payment.id);
    return;
  }

  if (payment.wallet_used_cents > 0) await debitWallet(payment);
  await scheduleInvoiceForPayment(payment.id);
  if (!payment.organization_id || !payment.plan_id) return;

  const { data: org } = await db.from("organizations").select("*").eq("id", payment.organization_id).maybeSingle();
  if (!org) return;
  const periodEnd = nextPeriodEnd({
    now: new Date(),
    currentPlanId: org.plan_id,
    purchasedPlanId: payment.plan_id,
    currentPeriodEnd: org.current_period_end ? new Date(org.current_period_end) : null,
    isRenewal: payment.is_renewal,
  });

  await db
    .from("organizations")
    .update({
      plan_id: payment.plan_id,
      subscription_status: "active",
      current_period_end: periodEnd.toISOString(),
      billing_owner_id: payment.user_id,
      cancel_at_period_end: false,
      pending_plan_id: null,
    })
    .eq("id", org.id);

  await log({
    organizationId: org.id,
    level: "info",
    source: "billing",
    event: payment.is_renewal ? "subscription_renewed" : "subscription_activated",
    message: `Plano ${payment.plan_id} ${payment.is_renewal ? "renovado" : "ativado"} via ${via} até ${periodEnd.toLocaleDateString("pt-BR")}.`,
    metadata: { paymentId: payment.id },
  });

  if (!payment.is_renewal) await rewardReferrer(payment.user_id, payment.plan_id);
}

async function debitWallet(payment: Payment) {
  const db = admin();
  const args = {
    p_user: payment.user_id,
    p_kind: "subscription_debit",
    p_description: `Assinatura ${payment.plan_id ?? ""}`.trim(),
    p_reference: `payment:${payment.id}`,
  };
  const { error } = await db.rpc("wallet_apply", { ...args, p_amount: -payment.wallet_used_cents });
  if (!error) return;
  // O saldo pode ter sido usado em outro pagamento nesse meio-tempo: debita o que houver.
  const available = Math.min(await getWalletBalance(payment.user_id), payment.wallet_used_cents);
  if (available > 0) await db.rpc("wallet_apply", { ...args, p_amount: -available });
  await log({
    organizationId: payment.organization_id,
    level: "warn",
    source: "billing",
    event: "wallet_short",
    message: `Saldo insuficiente no momento da confirmação: debitado ${formatCurrency(available)} de ${formatCurrency(payment.wallet_used_cents)}.`,
    metadata: { paymentId: payment.id },
  });
}

/** R$10 para quem indicou, se quem indicou tem plano pago ativo. Uma vez por indicação. */
async function rewardReferrer(referredUserId: string, planId: string) {
  const db = admin();
  const { data: referral } = await db
    .from("referrals")
    .select("*")
    .eq("referred_id", referredUserId)
    .eq("status", "pending")
    .maybeSingle();
  if (!referral) return;

  const { count } = await db
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("billing_owner_id", referral.referrer_id)
    .neq("plan_id", "free")
    .or(`billing_exempt.eq.true,current_period_end.gt.${new Date().toISOString()}`);

  if (!count) {
    await db.from("referrals").update({ status: "ineligible" }).eq("id", referral.id);
    return;
  }

  const { data: referred } = await db.from("profiles").select("full_name").eq("id", referredUserId).maybeSingle();
  const firstName = referred?.full_name?.split(" ")[0] ?? "Indicação";
  const { error } = await db.rpc("wallet_apply", {
    p_user: referral.referrer_id,
    p_amount: REFERRAL_REWARD_CENTS,
    p_kind: "referral_bonus",
    p_description: `Indicação: ${firstName} assinou o plano ${(await getPlan(planId).catch(() => null))?.name ?? planId}`,
    p_reference: `referral:${referral.id}`,
  });
  if (error) {
    await log({ level: "error", source: "billing", event: "referral_reward_failed", message: error.message });
    return;
  }
  await db
    .from("referrals")
    .update({ status: "rewarded", reward_cents: REFERRAL_REWARD_CENTS, rewarded_at: new Date().toISOString() })
    .eq("id", referral.id);
}

export async function failPayment(paymentId: string, reason: string) {
  const db = admin();
  const { data: payment } = await db
    .from("payments")
    .update({ status: "failed", failure_reason: reason })
    .eq("id", paymentId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (!payment?.organization_id || !payment.is_renewal) return;

  // Renovação não paga: volta ao Free imediatamente, se o período já venceu.
  const { data: org } = await db.from("organizations").select("*").eq("id", payment.organization_id).maybeSingle();
  if (org && org.plan_id !== "free" && (!org.current_period_end || new Date(org.current_period_end) <= new Date())) {
    await downgradeToFree(org.id, `renovação não paga (${reason})`);
  }
}

export async function refundPayment(paymentId: string) {
  const db = admin();
  const { data: payment } = await db
    .from("payments")
    .update({ status: "refunded" })
    .eq("id", paymentId)
    .eq("status", "paid")
    .select("*")
    .maybeSingle();
  if (!payment) return;

  if (payment.kind === "topup") {
    const available = Math.min(await getWalletBalance(payment.user_id), payment.amount_cents);
    if (available > 0) {
      await db.rpc("wallet_apply", {
        p_user: payment.user_id,
        p_amount: -available,
        p_kind: "adjustment",
        p_description: "Estorno de recarga Pix",
        p_reference: `refund:${payment.id}`,
      });
    }
    return;
  }
  if (payment.organization_id) {
    const { data: org } = await db.from("organizations").select("plan_id").eq("id", payment.organization_id).maybeSingle();
    if (org && org.plan_id === payment.plan_id) await downgradeToFree(payment.organization_id, "pagamento estornado");
  }
}

// ---- Downgrade -----------------------------------------------------------------------

/** Volta ao Free e pausa as automações que excedem o limite (mantém as editadas mais recentemente). */
export async function downgradeToFree(organizationId: string, reason: string) {
  const db = admin();
  const { data: current } = await db.from("organizations").select("billing_exempt").eq("id", organizationId).maybeSingle();
  if (current?.billing_exempt) return; // plano cortesia permanente
  await db
    .from("organizations")
    .update({
      plan_id: "free",
      subscription_status: "canceled",
      current_period_end: null,
      cancel_at_period_end: false,
      pending_plan_id: null,
    })
    .eq("id", organizationId);

  const free = await getPlan("free");
  const maxActive = Number((free.limits as { active_automations?: number }).active_automations ?? 1);
  let paused = 0;
  if (maxActive >= 0) {
    const { data: active } = await db
      .from("automations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .order("updated_at", { ascending: false });
    const excess = (active ?? []).slice(maxActive).map((a) => a.id);
    if (excess.length) {
      await db.from("automations").update({ status: "paused" }).in("id", excess);
      paused = excess.length;
    }
  }

  await log({
    organizationId,
    level: "warn",
    source: "billing",
    event: "downgraded_to_free",
    message: `Organização voltou ao plano Free: ${reason}.${paused ? ` ${paused} automação(ões) pausada(s) pelo limite do plano.` : ""}`,
  });
}

// ---- Renovação (agendador) ----------------------------------------------------------------

export async function processRenewals(now = new Date()) {
  const db = admin();
  const windowEnd = new Date(now.getTime() + RENEWAL_PIX_DAYS_BEFORE * 24 * 60 * 60 * 1000);
  const { data: orgs } = await db
    .from("organizations")
    .select("*")
    .neq("plan_id", "free")
    .eq("billing_exempt", false)
    .not("current_period_end", "is", null)
    .lte("current_period_end", windowEnd.toISOString());

  const summary = { checked: orgs?.length ?? 0, renewed: 0, pixCreated: 0, downgraded: 0, errors: 0 };

  for (const org of orgs ?? []) {
    try {
      const outcome = await renewOrganization(org, now);
      if (outcome === "renewed") summary.renewed++;
      if (outcome === "pix") summary.pixCreated++;
      if (outcome === "downgraded") summary.downgraded++;
    } catch (error) {
      summary.errors++;
      await log({ organizationId: org.id, level: "error", source: "billing", event: "renewal_error", message: errorMessage(error) });
    }
  }
  return summary;
}

async function renewOrganization(org: Organization, now: Date): Promise<"renewed" | "pix" | "downgraded" | "noop"> {
  const db = admin();
  const periodEnd = new Date(org.current_period_end!);
  const due = periodEnd <= now;
  const periodKey = toBrazilDate(periodEnd);

  if (org.cancel_at_period_end || !org.billing_owner_id) {
    if (!due) return "noop";
    await downgradeToFree(org.id, org.cancel_at_period_end ? "assinatura cancelada pelo usuário" : "sem responsável pelo pagamento");
    return "downgraded";
  }

  const { data: existing } = await db
    .from("payments")
    .select("*")
    .eq("organization_id", org.id)
    .eq("is_renewal", true)
    .eq("due_date", periodKey)
    .in("status", ["pending", "paid"])
    .maybeSingle();
  if (existing?.status === "paid") return "noop";

  const plan = await getPlan(org.plan_id);
  const payer = org.billing_owner_id;
  const { walletCents, chargeCents } = splitWithWallet(plan.price_cents, await getWalletBalance(payer));
  const card = await getDefaultCard(payer);
  const base = {
    userId: payer,
    organizationId: org.id,
    kind: "subscription" as const,
    planId: plan.id,
    isRenewal: true,
    amountCents: plan.price_cents,
    walletCents,
    chargeCents,
    remoteIp: "",
    description: `ChatFlow — renovação do plano ${plan.name}`,
    dueDate: periodKey,
  };

  if (!due) {
    // Janela de 3 dias: só gera Pix quando não há como cobrar automaticamente no vencimento.
    if (existing || chargeCents === 0 || card) return "noop";
    const result = await createAndCharge({ ...base, payWith: { method: "pix" } });
    return result.status === "failed" ? "noop" : "pix";
  }

  if (existing) {
    // Vencido com Pix pendente: se agora há saldo ou cartão, troca o Pix pela cobrança automática;
    // senão volta ao Free na hora (pagar o Pix depois reativa o plano).
    if (chargeCents > 0 && !card) {
      await downgradeToFree(org.id, "Pix de renovação não pago até o vencimento");
      return "downgraded";
    }
    if (existing.provider_payment_id) await asaas.deletePayment(existing.provider_payment_id).catch(() => undefined);
    await db.from("payments").update({ status: "canceled" }).eq("id", existing.id).eq("status", "pending");
  }
  if (chargeCents > 0 && !card) {
    await downgradeToFree(org.id, "sem saldo suficiente nem cartão para a renovação");
    return "downgraded";
  }

  const result = await createAndCharge({ ...base, payWith: card ? { method: "card", cardId: card.id } : { method: "pix" } });
  if (result.status === "paid") return "renewed";
  if (result.status === "failed") {
    await downgradeToFree(org.id, `cartão recusado na renovação (${result.error})`);
    return "downgraded";
  }
  return "noop";
}

// ---- Webhook ---------------------------------------------------------------------------

type AsaasEvent = {
  id: string;
  event: string;
  payment?: { id: string; externalReference?: string | null; status?: string };
  invoice?: { id: string; externalReference?: string | null; statusDescription?: string | null };
};

export async function processBillingEvent(eventId: string) {
  const db = admin();
  const { data: row } = await db.from("billing_events").select("*").eq("id", eventId).maybeSingle();
  if (!row || row.processed_at) return;

  try {
    const event = row.payload as unknown as AsaasEvent;
    if (event.invoice && event.event.startsWith("INVOICE_")) await handleInvoiceEvent(event.event, event.invoice);
    const payment = event.payment ? await findPayment(event.payment.id, event.payment.externalReference) : null;
    if (payment) {
      switch (event.event) {
        case "PAYMENT_CONFIRMED":
        case "PAYMENT_RECEIVED":
          await confirmPayment(payment.id, "webhook");
          break;
        case "PAYMENT_OVERDUE":
          await failPayment(payment.id, "vencido sem pagamento");
          break;
        case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED":
          await failPayment(payment.id, "cartão recusado");
          break;
        case "PAYMENT_REPROVED_BY_RISK_ANALYSIS":
          await failPayment(payment.id, "reprovado na análise de risco");
          break;
        case "PAYMENT_DELETED":
          await db.from("payments").update({ status: "canceled" }).eq("id", payment.id).eq("status", "pending");
          break;
        case "PAYMENT_REFUNDED":
        case "PAYMENT_CHARGEBACK_REQUESTED":
          await refundPayment(payment.id);
          break;
      }
    }
    await db.from("billing_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", eventId);
  } catch (error) {
    await db.from("billing_events").update({ error: errorMessage(error) }).eq("id", eventId);
    await log({ level: "error", source: "billing", event: "webhook_failed", message: errorMessage(error), metadata: { eventId } });
  }
}

async function findPayment(providerPaymentId: string, externalReference?: string | null) {
  const db = admin();
  const { data } = await db.from("payments").select("*").eq("provider_payment_id", providerPaymentId).maybeSingle();
  if (data) return data;
  if (!externalReference || !/^[0-9a-f-]{36}$/.test(externalReference)) return null;
  const { data: byRef } = await db.from("payments").select("*").eq("id", externalReference).maybeSingle();
  return byRef;
}

/** Fallback do polling da tela: consulta o Asaas caso o webhook ainda não tenha chegado. */
export async function syncPaymentStatus(payment: Payment) {
  if (payment.status !== "pending" || !payment.provider_payment_id) return payment.status;
  try {
    const remote = await asaas.getPayment(payment.provider_payment_id);
    if (asaas.PAID_STATUSES.includes(remote.status)) {
      await confirmPayment(payment.id, "consulta");
      return "paid" as const;
    }
  } catch {
    // Sem conexão com o Asaas: mantém pendente e tenta no próximo ciclo
  }
  return payment.status;
}
