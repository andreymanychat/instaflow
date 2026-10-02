import "server-only";
import { z } from "zod";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import * as asaas from "@/server/integrations/asaas/client";
import { toBrazilDate } from "@/server/billing/pricing";
import { errorMessage, log } from "@/server/services/logger";
import type { Tables } from "@/types/database";

/**
 * Emissão automática de NFS-e pelo Asaas para cada cobrança paga no Asaas (Pix ou cartão).
 * A parte paga com saldo da carteira não gera nova nota: recargas já têm nota própria e
 * créditos de indicação são desconto. Regras fiscais (código de serviço, alíquotas) vêm do
 * contador via ASAAS_INVOICE_CONFIG — sem ela nada é emitido.
 */

const configSchema = z
  .object({
    municipalServiceId: z.string().optional(),
    municipalServiceCode: z.string().optional(),
    municipalServiceName: z.string().min(3),
    observations: z.string().default(""),
    taxes: z.object({
      retainIss: z.boolean().default(false),
      iss: z.number().min(0).max(5),
      pis: z.number().min(0).default(0),
      cofins: z.number().min(0).default(0),
      csll: z.number().min(0).default(0),
      inss: z.number().min(0).default(0),
      ir: z.number().min(0).default(0),
    }),
  })
  .refine((c) => c.municipalServiceId || c.municipalServiceCode, "Informe municipalServiceId ou municipalServiceCode.");

export type InvoiceConfig = z.infer<typeof configSchema>;

export function getInvoiceConfig(): InvoiceConfig | null {
  const raw = env().ASAAS_INVOICE_CONFIG;
  if (!raw) return null;
  const parsed = configSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error(`ASAAS_INVOICE_CONFIG inválida: ${parsed.error.issues[0]?.message}`);
  return parsed.data;
}

function describe(payment: Tables<"payments">) {
  if (payment.kind === "topup") return "Créditos pré-pagos para uso na plataforma ChatFlow (automação de Instagram).";
  const plan = payment.plan_id ? payment.plan_id.charAt(0).toUpperCase() + payment.plan_id.slice(1) : "";
  return `Assinatura mensal do software ChatFlow — plano ${plan} (automação de atendimento no Instagram).`;
}

/** Agenda a nota da cobrança paga. Idempotente: só uma chamada por pagamento chega ao Asaas. */
export async function scheduleInvoiceForPayment(paymentId: string) {
  let config: InvoiceConfig | null;
  try {
    config = getInvoiceConfig();
  } catch (error) {
    await log({ level: "error", source: "billing", event: "invoice_config_invalid", message: errorMessage(error) });
    return;
  }
  if (!config) return;

  const db = createAdminClient();
  const { data: payment } = await db
    .from("payments")
    .update({ invoice_status: "scheduling" })
    .eq("id", paymentId)
    .eq("status", "paid")
    .is("invoice_status", null)
    .not("provider_payment_id", "is", null)
    .select("*")
    .maybeSingle();
  if (!payment) return;

  const value = (payment.amount_cents - payment.wallet_used_cents) / 100;
  if (value <= 0) {
    await db.from("payments").update({ invoice_status: null }).eq("id", payment.id);
    return;
  }

  try {
    const invoice = await asaas.scheduleInvoice({
      payment: payment.provider_payment_id!,
      serviceDescription: describe(payment),
      observations: config.observations,
      externalReference: payment.id,
      value: Number(value.toFixed(2)),
      deductions: 0,
      effectiveDate: toBrazilDate(new Date()),
      municipalServiceId: config.municipalServiceId,
      municipalServiceCode: config.municipalServiceCode,
      municipalServiceName: config.municipalServiceName,
      taxes: config.taxes,
    });
    await db.from("payments").update({ invoice_id: invoice.id, invoice_status: "scheduled", invoice_error: null }).eq("id", payment.id);
  } catch (error) {
    const message = errorMessage(error);
    await db.from("payments").update({ invoice_status: "error", invoice_error: message }).eq("id", payment.id);
    await log({
      organizationId: payment.organization_id,
      level: "error",
      source: "billing",
      event: "invoice_schedule_failed",
      message: `Falha ao agendar nota fiscal: ${message}`,
      metadata: { paymentId: payment.id },
    });
  }
}

/** Eventos INVOICE_* do webhook. */
export async function handleInvoiceEvent(event: string, invoice: { id: string; externalReference?: string | null; statusDescription?: string | null }) {
  const db = createAdminClient();
  const status = event === "INVOICE_AUTHORIZED" ? "authorized" : event === "INVOICE_ERROR" ? "error" : event === "INVOICE_CANCELED" ? "canceled" : null;
  if (!status) return;

  const { data: payment } = await db
    .from("payments")
    .update({ invoice_status: status, invoice_error: status === "error" ? (invoice.statusDescription ?? "Erro na emissão") : null })
    .eq("invoice_id", invoice.id)
    .select("id, organization_id")
    .maybeSingle();

  if (payment && status === "error") {
    await log({
      organizationId: payment.organization_id,
      level: "error",
      source: "billing",
      event: "invoice_error",
      message: `Prefeitura recusou a nota fiscal: ${invoice.statusDescription ?? "sem detalhes"}`,
      metadata: { paymentId: payment.id },
    });
  }
}
