import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REFERRAL_COOKIE } from "@/server/billing/referral-cookie";

export const dynamic = "force-dynamic";

/** Link "Indique e ganhe": guarda o código em cookie até o fim da validade (3 dias) e leva ao cadastro. */
export async function GET(request: NextRequest, { params }: RouteContext<"/r/[code]">) {
  const { code } = await params;
  const signup = new URL("/signup", request.url);

  const { data: link } = /^[0-9a-f]{10}$/.test(code)
    ? await createAdminClient().from("referral_links").select("code, expires_at").eq("code", code).maybeSingle()
    : { data: null };

  if (!link || new Date(link.expires_at) <= new Date()) {
    signup.searchParams.set("indicacao", "expirada");
    return NextResponse.redirect(signup);
  }

  signup.searchParams.set("indicacao", "1");
  const response = NextResponse.redirect(signup);
  response.cookies.set(REFERRAL_COOKIE, link.code, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(link.expires_at),
  });
  return response;
}
