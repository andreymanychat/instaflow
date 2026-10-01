"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, safeAction } from "@/lib/action-result";
import { requireAdmin } from "@/server/auth/session";
import * as ig from "@/server/integrations/instagram/client";
import { getAccessToken, handleAccountApiError } from "@/server/services/instagram-account-service";
import { errorMessage, log } from "@/server/services/logger";

async function loadOwnedAccount(accountId: string) {
  const { organization } = await requireAdmin();
  const { data: account } = await createAdminClient()
    .from("instagram_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!account) throw new Error("Conta não encontrada.");
  return account;
}

export async function disconnectInstagramAccount(accountId: string) {
  return safeAction(async () => {
    const account = await loadOwnedAccount(accountId);
    try {
      await ig.unsubscribeFromWebhooks(getAccessToken(account));
    } catch {
      // Token pode já estar inválido; a remoção local segue mesmo assim.
    }
    await createAdminClient().from("instagram_accounts").delete().eq("id", account.id);
    await log({
      organizationId: account.organization_id,
      level: "warn",
      source: "instagram",
      event: "account_disconnected",
      message: `Conta @${account.username} desconectada.`,
    });
    revalidatePath("/settings/instagram");
    return ok();
  });
}

export async function resubscribeWebhooks(accountId: string) {
  return safeAction(async () => {
    const account = await loadOwnedAccount(accountId);
    try {
      const token = getAccessToken(account);
      const [result, profile] = await Promise.all([ig.subscribeToWebhooks(token), ig.getMe(token)]);
      await createAdminClient()
        .from("instagram_accounts")
        .update({
          webhook_subscribed: result.success,
          last_error: null,
          username: profile.username,
          name: profile.name ?? null,
          profile_picture_url: profile.profile_picture_url ?? null,
          followers_count: profile.followers_count ?? null,
        })
        .eq("id", account.id);
      revalidatePath("/settings/instagram");
      return ok();
    } catch (error) {
      await handleAccountApiError(account, error);
      return fail(errorMessage(error));
    }
  });
}
