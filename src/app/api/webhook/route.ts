import { after, NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/crypto";
import { parseJsonSafe } from "@/lib/safe-json";
import { isValidWebhookSignature } from "@/server/integrations/instagram/signature";
import { processWebhookPayload } from "@/server/services/webhook-processor";
import { log } from "@/server/services/logger";
import type { IgWebhookPayload } from "@/server/integrations/instagram/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Verificação do webhook (botão "Verificar e salvar" no painel da Meta). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge") ?? "";

  if (mode === "subscribe" && safeEqual(token, env().META_WEBHOOK_VERIFY_TOKEN)) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Recebimento de eventos. Responde 200 rápido e processa depois da resposta. */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!isValidWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    await log({
      level: "warn",
      source: "webhook",
      event: "invalid_signature",
      message: "Webhook rejeitado: assinatura X-Hub-Signature-256 inválida.",
    });
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: IgWebhookPayload;
  try {
    payload = parseJsonSafe<IgWebhookPayload>(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  after(() => processWebhookPayload(payload));
  return NextResponse.json({ received: true });
}
