import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { hmacSha256Hex, safeEqual } from "@/lib/crypto";
import { parseJsonSafe } from "@/lib/safe-json";

/**
 * Segredos aceitos para validar assinaturas. No fluxo "Instagram API com login do
 * Instagram" a Meta assina com a chave secreta do app do Instagram; aceitamos também
 * a chave do app Meta (Configurações → Básico) caso ela esteja configurada.
 */
function signingSecrets(): string[] {
  const { INSTAGRAM_APP_SECRET, META_APP_SECRET } = env();
  return [INSTAGRAM_APP_SECRET, META_APP_SECRET].filter((s): s is string => Boolean(s));
}

/** Valida o header X-Hub-Signature-256 enviado pela Meta em cada webhook. */
export function isValidWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  return signingSecrets().some((secret) => safeEqual(`sha256=${hmacSha256Hex(secret, rawBody)}`, signatureHeader));
}

/**
 * Decodifica o `signed_request` enviado nos callbacks de desautorização
 * e exclusão de dados. Retorna null se a assinatura não bater.
 */
export function parseSignedRequest(signedRequest: string): { user_id: string; algorithm: string } | null {
  const [encodedSig, payload] = signedRequest.split(".", 2);
  if (!encodedSig || !payload) return null;

  const signature = encodedSig.replace(/=+$/, "");
  const valid = signingSecrets().some((secret) =>
    safeEqual(createHmac("sha256", secret).update(payload).digest("base64url"), signature),
  );
  if (!valid) return null;

  try {
    const data = parseJsonSafe<{ algorithm?: string; user_id?: string | number }>(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (data.algorithm?.toUpperCase() !== "HMAC-SHA256") return null;
    const userId = String(data.user_id ?? "");
    if (!/^\d+$/.test(userId)) return null; // usado em filtros de query: apenas dígitos
    return { algorithm: data.algorithm, user_id: userId };
  } catch {
    return null;
  }
}
