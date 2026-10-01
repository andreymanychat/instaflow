import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { parseSignedRequest } from "@/server/integrations/instagram/signature";
import { log } from "@/server/services/logger";

export const dynamic = "force-dynamic";

/**
 * Callback de exclusão de dados exigido pela Meta.
 * Remove a conta conectada (cascade apaga contatos, conversas, mensagens e comentários)
 * e responde com a URL de status + código de confirmação, conforme a especificação.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const data = parseSignedRequest(String(form.get("signed_request") ?? ""));
  if (!data) return new NextResponse("Invalid signed_request", { status: 400 });

  const admin = createAdminClient();
  const { data: deleted } = await admin
    .from("instagram_accounts")
    .delete()
    .or(`ig_user_id.eq.${data.user_id},ig_app_scoped_id.eq.${data.user_id}`)
    .select("organization_id, username");

  // Também remove o usuário como contato em qualquer conta conectada
  await admin.from("contacts").delete().eq("igsid", data.user_id);

  const { data: request_ } = await admin
    .from("data_deletion_requests")
    .insert({ ig_user_id: data.user_id })
    .select("confirmation_code")
    .single();

  for (const account of deleted ?? []) {
    await log({
      organizationId: null,
      level: "warn",
      source: "oauth",
      event: "data_deleted",
      message: `Dados de @${account.username} excluídos a pedido do usuário (Meta).`,
    });
  }

  const code = request_?.confirmation_code ?? "unknown";
  return NextResponse.json({
    url: `${env().NEXT_PUBLIC_APP_URL}/exclusao-de-dados?codigo=${code}`,
    confirmation_code: code,
  });
}
