import { after, NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { processBillingEvent } from "@/server/billing/billing-service";
import type { Json } from "@/types/database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Webhook do Asaas (Integrações → Webhooks). Autenticado pelo header `asaas-access-token`.
 * Grava o evento bruto (id único = idempotência) e responde 200 na hora; o processamento
 * roda depois da resposta — o Asaas pausa a fila após 15 falhas seguidas.
 */
export async function POST(request: NextRequest) {
  const expected = env().ASAAS_WEBHOOK_TOKEN;
  if (!expected) return NextResponse.json({ error: "Webhook de cobrança não configurado" }, { status: 503 });
  if (!safeEqual(request.headers.get("asaas-access-token") ?? "", expected)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  let event: { id?: string; event?: string };
  try {
    event = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!event.id || !event.event) return NextResponse.json({ received: true, ignored: true });

  const { error } = await createAdminClient()
    .from("billing_events")
    .upsert({ id: event.id, event: event.event, payload: event as Json }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: "Falha ao registrar evento" }, { status: 500 });

  const eventId = event.id;
  after(() => processBillingEvent(eventId));
  return NextResponse.json({ received: true });
}
