import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOrgContext, canManage } from "@/server/auth/session";
import { buildAuthorizeUrl } from "@/server/integrations/instagram/client";
import { randomToken, signValue } from "@/lib/crypto";
import { checkLimit } from "@/server/services/plan-service";
import { env } from "@/lib/env";
import { OAUTH_STATE_COOKIE } from "@/server/integrations/instagram/oauth-state";

export const dynamic = "force-dynamic";

/** Inicia o OAuth oficial do Instagram (Business Login) para a organização ativa. */
export async function GET() {
  const { organization, role, user } = await getOrgContext();
  const settingsUrl = new URL("/settings/instagram", env().NEXT_PUBLIC_APP_URL);

  if (!canManage(role)) {
    settingsUrl.searchParams.set("error", "Apenas administradores podem conectar contas.");
    return NextResponse.redirect(settingsUrl);
  }

  const quota = await checkLimit(organization.id, "instagram_accounts");
  if (!quota.allowed) {
    settingsUrl.searchParams.set("error", `Seu plano permite ${quota.limit} conta(s). Faça upgrade para conectar mais.`);
    return NextResponse.redirect(settingsUrl);
  }

  // state = nonce + org + user, assinado com HMAC e guardado em cookie httpOnly (proteção CSRF)
  const state = signValue(`${randomToken(16)}~${organization.id}~${user.id}`);
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
