import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseSignedRequest } from "@/server/integrations/instagram/signature";
import { log } from "@/server/services/logger";

export const dynamic = "force-dynamic";

/**
 * Chamado pela Meta quando o usuário remove o app nas configurações do Instagram.
 * Marcamos a conta como revogada (as automações param imediatamente).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const data = parseSignedRequest(String(form.get("signed_request") ?? ""));
  if (!data) return new NextResponse("Invalid signed_request", { status: 400 });

  const admin = createAdminClient();
  const { data: accounts } = await admin
    .from("instagram_accounts")
    .update({ status: "revoked", last_error: "Acesso removido pelo usuário no Instagram." })
    .or(`ig_user_id.eq.${data.user_id},ig_app_scoped_id.eq.${data.user_id}`)
    .select("organization_id, username");

  for (const account of accounts ?? []) {
    await log({
      organizationId: account.organization_id,
      level: "warn",
      source: "oauth",
      event: "deauthorized",
      message: `@${account.username} removeu a autorização do app.`,
    });
  }

  return NextResponse.json({ success: true });
}
