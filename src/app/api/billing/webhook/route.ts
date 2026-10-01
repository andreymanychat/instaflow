import { NextResponse, type NextRequest } from "next/server";
import { isStripeConfigured } from "@/lib/env";
import { log } from "@/server/services/logger";

export const dynamic = "force-dynamic";

/**
 * Endpoint reservado para o webhook do Stripe.
 * Eventos a tratar quando ativar: checkout.session.completed,
 * customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed.
 * Cada um deve atualizar organizations.plan_id / subscription_status / current_period_end.
 */
export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Stripe não configurado" }, { status: 501 });
  }
  const signature = request.headers.get("stripe-signature");
  await log({
    level: "info",
    source: "billing",
    event: "webhook_received",
    message: `Webhook de billing recebido (assinatura ${signature ? "presente" : "ausente"}). Implementação pendente.`,
  });
  return NextResponse.json({ received: true });
}
