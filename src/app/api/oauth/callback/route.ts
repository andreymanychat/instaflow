import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { safeEqual, verifySignedValue } from "@/lib/crypto";
import { getUser } from "@/server/auth/session";
import { connectAccountFromOAuth } from "@/server/services/instagram-account-service";
import { errorMessage, log } from "@/server/services/logger";
import { OAUTH_STATE_COOKIE } from "@/server/integrations/instagram/oauth-state";

export const dynamic = "force-dynamic";

/** Redirect URI cadastrada no app da Meta: /api/oauth/callback */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const target = new URL("/settings/instagram", env().NEXT_PUBLIC_APP_URL);
  const fail = (message: string) => {
    target.searchParams.set("error", message);
    return NextResponse.redirect(target);
  };

  if (params.get("error")) {
    return fail(params.get("error_description") ?? "Conexão cancelada no Instagram.");
  }

  const code = params.get("code")?.replace(/#_$/, ""); // a Meta anexa "#_" ao code
  const state = params.get("state") ?? "";
  const cookieStore = await cookies();
  const storedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value ?? "";
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !storedState || !safeEqual(state, storedState)) {
    return fail("Sessão de conexão expirada. Tente novamente.");
  }

  const value = verifySignedValue(state);
  const [, organizationId, userId] = value?.split("~") ?? [];
  const user = await getUser();
  if (!organizationId || !user || user.id !== userId) {
    return fail("Estado OAuth inválido.");
  }

  try {
    const account = await connectAccountFromOAuth({ code, organizationId, userId });
    target.searchParams.set("connected", account.username);
    return NextResponse.redirect(target);
  } catch (error) {
    await log({
      organizationId,
      level: "error",
      source: "oauth",
      event: "connect_failed",
      message: `Falha ao conectar Instagram: ${errorMessage(error)}`,
    });
    return fail(errorMessage(error));
  }
}
