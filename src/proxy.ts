import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth",
  "/privacidade",
  "/termos",
  "/exclusao-de-dados",
  "/remover-dados",
  "/invite",
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // A Meta envia o callback de exclusão de dados (POST) para a mesma URL da página pública.
  if (pathname === "/exclusao-de-dados" && request.method === "POST") {
    return NextResponse.rewrite(new URL("/api/oauth/data-deletion", request.url));
  }

  const { response, user } = await updateSession(request);

  const isPublic = pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // APIs (webhook, OAuth, cron) fazem a própria autenticação e não passam pelo proxy.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
