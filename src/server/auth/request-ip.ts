import "server-only";
import { headers } from "next/headers";

/** IP real do cliente (exigido pelo Asaas na tokenização e cobrança com cartão). Na Vercel vem em x-forwarded-for. */
export async function getClientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "127.0.0.1";
}
