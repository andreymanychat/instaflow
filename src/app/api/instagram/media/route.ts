import { NextResponse, type NextRequest } from "next/server";
import { getOrgContext } from "@/server/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccessToken } from "@/server/services/instagram-account-service";
import { listMedia } from "@/server/integrations/instagram/client";
import { errorMessage } from "@/server/services/logger";

export const dynamic = "force-dynamic";

/** Lista as publicações recentes de uma conta (usado para escolher posts no gatilho de comentário). */
export async function GET(request: NextRequest) {
  const { organization } = await getOrgContext();
  const accountId = request.nextUrl.searchParams.get("accountId");

  let query = createAdminClient()
    .from("instagram_accounts")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("status", "active");
  if (accountId) query = query.eq("id", accountId);

  const { data: accounts } = await query.limit(1);
  const account = accounts?.[0];
  if (!account) return NextResponse.json({ media: [] });

  try {
    const media = await listMedia(getAccessToken(account));
    return NextResponse.json({ media });
  } catch (error) {
    return NextResponse.json({ media: [], error: errorMessage(error) }, { status: 502 });
  }
}
