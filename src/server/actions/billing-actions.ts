"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env, isBillingConfigured } from "@/lib/env";
import { fail, ok, safeAction, zodError } from "@/lib/action-result";
import { isValidCardNumber, onlyDigits } from "@/lib/br";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireUser } from "@/server/auth/session";
import { getClientIp } from "@/server/auth/request-ip";
import * as asaas from "@/server/integrations/asaas/client";
import {
  BillingError,
  saveCard,
  startSubscriptionCheckout,
  startWalletTopUp,
  syncPaymentStatus,
  type CheckoutResult,
} from "@/server/billing/billing-service";
import { MAX_TOPUP_CENTS, MIN_TOPUP_CENTS } from "@/server/billing/pricing";
import { errorMessage, log } from "@/server/services/logger";

const cardSchema = z.object({
  holderName: z.string().trim().min(3, "Informe o nome impresso no cartão.").max(100),
  // Os cartões de teste do sandbox do Asaas (ex.: 4444 4444 4444 4444) não passam no Luhn
  number: z
    .string()
    .transform(onlyDigits)
    .refine((n) => (env().ASAAS_ENVIRONMENT === "sandbox" ? /^\d{13,19}$/.test(n) : isValidCardNumber(n)), "Número do cartão inválido."),
  expiry: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Validade no formato MM/AA.")
    .refine((value) => {
      const [month, year] = value.split("/").map(Number);
      const now = new Date();
      const current = (now.getFullYear() % 100) * 100 + now.getMonth() + 1;
      return year * 100 + month >= current;
    }, "Cartão vencido."),
  ccv: z.string().regex(/^\d{3,4}$/, "CVV inválido."),
});

export type CardInput = z.input<typeof cardSchema>;

const toAsaasCard = (card: z.infer<typeof cardSchema>) => {
  const [month, year] = card.expiry.split("/");
  return { holderName: card.holderName, number: card.number, expiryMonth: month, expiryYear: `20${year}`, ccv: card.ccv };
};

/** Mensagens do Asaas/validação sobem para a tela; o resto vira mensagem genérica (sem vazar detalhes). */
function billingMessage(error: unknown) {
  if (error instanceof BillingError || error instanceof asaas.AsaasError) return error.message;
  return "Não foi possível processar o pagamento agora. Tente novamente.";
}

const paymentSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("pix") }),
  z.object({ method: z.literal("card"), cardId: z.uuid() }),
  z.object({ method: z.literal("new_card"), card: cardSchema }),
]);

export type CheckoutPaymentInput = z.input<typeof paymentSchema>;

export async function checkoutPlan(input: { planId: string; payment: CheckoutPaymentInput }) {
  return safeAction<CheckoutResult>(async () => {
    if (!isBillingConfigured()) return fail("Pagamentos ainda não estão habilitados.");
    const { organization, user } = await requireAdmin();
    const parsed = paymentSchema.safeParse(input.payment);
    if (!parsed.success) return zodError(parsed.error);
    const planId = z.enum(["pro", "business"]).safeParse(input.planId);
    if (!planId.success) return fail("Plano inválido.");

    try {
      const payWith =
        parsed.data.method === "new_card" ? { method: "new_card" as const, card: toAsaasCard(parsed.data.card) } : parsed.data;
      const result = await startSubscriptionCheckout({
        userId: user.id,
        organization,
        planId: planId.data,
        payWith,
        remoteIp: await getClientIp(),
      });
      revalidatePath("/", "layout");
      return ok(result);
    } catch (error) {
      // Nunca loga o input (pode conter dados do cartão): só a mensagem do erro
      await log({ organizationId: organization.id, level: "warn", source: "billing", event: "checkout_error", message: errorMessage(error) });
      return fail(billingMessage(error));
    }
  });
}

export async function topUpWallet(amountReais: number) {
  return safeAction<CheckoutResult>(async () => {
    if (!isBillingConfigured()) return fail("Pagamentos ainda não estão habilitados.");
    const user = await requireUser();
    const cents = Math.round(amountReais * 100);
    if (!Number.isFinite(cents) || cents < MIN_TOPUP_CENTS || cents > MAX_TOPUP_CENTS) {
      return fail(`A recarga deve ser entre R$ ${MIN_TOPUP_CENTS / 100} e R$ ${(MAX_TOPUP_CENTS / 100).toLocaleString("pt-BR")}.`);
    }
    try {
      const result = await startWalletTopUp({ userId: user.id, amountCents: cents });
      revalidatePath("/account/wallet");
      return ok(result);
    } catch (error) {
      return fail(billingMessage(error));
    }
  });
}

/** Polling da tela de pagamento. Só enxerga pagamentos do próprio usuário (RLS). */
export async function getPaymentStatus(paymentId: string) {
  return safeAction(async () => {
    await requireUser();
    const supabase = await createClient();
    const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).maybeSingle();
    if (!payment) return fail("Pagamento não encontrado.");
    const status = await syncPaymentStatus(payment);
    if (status === "paid") revalidatePath("/", "layout");
    return ok({ status, failureReason: payment.failure_reason });
  });
}

export async function addCard(input: CardInput) {
  return safeAction(async () => {
    if (!isBillingConfigured()) return fail("Pagamentos ainda não estão habilitados.");
    const user = await requireUser();
    const parsed = cardSchema.safeParse(input);
    if (!parsed.success) return zodError(parsed.error);
    try {
      const card = await saveCard(user.id, toAsaasCard(parsed.data), await getClientIp());
      revalidatePath("/account/wallet");
      return ok(card);
    } catch (error) {
      return fail(billingMessage(error));
    }
  });
}

export async function removeCard(cardId: string) {
  return safeAction(async () => {
    const user = await requireUser();
    const db = createAdminClient();
    const { data: removed } = await db
      .from("payment_methods")
      .delete()
      .eq("id", cardId)
      .eq("user_id", user.id)
      .select("is_default")
      .maybeSingle();
    if (!removed) return fail("Cartão não encontrado.");
    if (removed.is_default) {
      const { data: next } = await db
        .from("payment_methods")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (next) await db.from("payment_methods").update({ is_default: true }).eq("id", next.id);
    }
    revalidatePath("/account/wallet");
    return ok();
  });
}

export async function setDefaultCard(cardId: string) {
  return safeAction(async () => {
    const user = await requireUser();
    const db = createAdminClient();
    const { data: card } = await db.from("payment_methods").select("id").eq("id", cardId).eq("user_id", user.id).maybeSingle();
    if (!card) return fail("Cartão não encontrado.");
    await db.from("payment_methods").update({ is_default: false }).eq("user_id", user.id);
    await db.from("payment_methods").update({ is_default: true }).eq("id", card.id);
    revalidatePath("/account/wallet");
    return ok();
  });
}

/** Cancela ao fim do período (o plano continua até lá) ou desfaz o cancelamento. */
export async function setCancelAtPeriodEnd(cancel: boolean) {
  return safeAction(async () => {
    const { organization } = await requireAdmin();
    if (organization.plan_id === "free") return fail("Esta organização já está no plano Free.");
    if (organization.billing_exempt) return fail("Esta organização tem plano cortesia permanente.");
    const db = createAdminClient();
    await db.from("organizations").update({ cancel_at_period_end: cancel }).eq("id", organization.id);

    if (cancel) {
      // Pix de renovação já emitido deixa de valer
      const { data: pending } = await db
        .from("payments")
        .select("id, provider_payment_id")
        .eq("organization_id", organization.id)
        .eq("is_renewal", true)
        .eq("status", "pending");
      for (const payment of pending ?? []) {
        if (payment.provider_payment_id) await asaas.deletePayment(payment.provider_payment_id).catch(() => undefined);
        await db.from("payments").update({ status: "canceled" }).eq("id", payment.id);
      }
    }
    await log({
      organizationId: organization.id,
      level: "info",
      source: "billing",
      event: cancel ? "cancel_scheduled" : "cancel_reverted",
      message: cancel ? "Cancelamento agendado para o fim do período." : "Cancelamento desfeito; a assinatura será renovada.",
    });
    revalidatePath("/billing");
    return ok();
  });
}
