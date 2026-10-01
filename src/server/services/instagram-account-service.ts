import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import * as ig from "@/server/integrations/instagram/client";
import { MetaApiError } from "@/server/integrations/instagram/client";
import { errorMessage, log } from "@/server/services/logger";
import type { Tables } from "@/types/database";

export type InstagramAccount = Tables<"instagram_accounts">;

export async function findAccountByIgUserId(igUserId: string) {
  const { data } = await createAdminClient()
    .from("instagram_accounts")
    .select("*")
    .eq("ig_user_id", igUserId)
    .maybeSingle();
  return data;
}

export async function findAccountById(id: string) {
  const { data } = await createAdminClient().from("instagram_accounts").select("*").eq("id", id).maybeSingle();
  return data;
}

export function getAccessToken(account: Pick<InstagramAccount, "access_token_encrypted">) {
  return decryptSecret(account.access_token_encrypted);
}

/** Marca a conta como expirada quando a Meta rejeita o token (código 190). */
export async function handleAccountApiError(account: InstagramAccount, error: unknown) {
  if (error instanceof MetaApiError && error.isAuthError) {
    await createAdminClient()
      .from("instagram_accounts")
      .update({ status: "expired", last_error: error.message })
      .eq("id", account.id);
    await log({
      organizationId: account.organization_id,
      level: "error",
      source: "instagram",
      event: "token_invalid",
      message: `Token da conta @${account.username} inválido. Reconecte a conta.`,
    });
  }
}

/**
 * Conclui a conexão OAuth: troca o code por token longo (60 dias),
 * busca o perfil, grava criptografado e assina os webhooks da conta.
 */
export async function connectAccountFromOAuth(params: { code: string; organizationId: string; userId: string }) {
  const shortLived = await ig.exchangeCodeForToken(params.code);
  const longLived = await ig.exchangeForLongLivedToken(shortLived.access_token);
  const profile = await ig.getMe(longLived.access_token);

  const admin = createAdminClient();
  const existing = await findAccountByIgUserId(profile.user_id);
  if (existing && existing.organization_id !== params.organizationId) {
    throw new Error(`A conta @${profile.username} já está conectada em outra organização.`);
  }

  let webhookSubscribed = false;
  let lastError: string | null = null;
  try {
    const result = await ig.subscribeToWebhooks(longLived.access_token);
    webhookSubscribed = result.success;
  } catch (error) {
    lastError = `Falha ao assinar webhooks: ${errorMessage(error)}`;
  }

  const { data, error } = await admin
    .from("instagram_accounts")
    .upsert(
      {
        organization_id: params.organizationId,
        ig_user_id: profile.user_id,
        ig_app_scoped_id: String(shortLived.user_id),
        username: profile.username,
        name: profile.name ?? null,
        profile_picture_url: profile.profile_picture_url ?? null,
        followers_count: profile.followers_count ?? null,
        access_token_encrypted: encryptSecret(longLived.access_token),
        token_expires_at: new Date(Date.now() + longLived.expires_in * 1000).toISOString(),
        status: "active",
        webhook_subscribed: webhookSubscribed,
        connected_by: params.userId,
        last_error: lastError,
      },
      { onConflict: "ig_user_id" },
    )
    .select("*")
    .single();

  if (error) throw error;

  await log({
    organizationId: params.organizationId,
    source: "instagram",
    event: "account_connected",
    message: `Conta @${profile.username} conectada${webhookSubscribed ? "" : " (webhooks pendentes)"}.`,
    metadata: { ig_user_id: profile.user_id, lastError },
  });

  return data;
}

/** Renova tokens que expiram nos próximos 10 dias (chamado pelo cron diário). */
export async function refreshExpiringTokens() {
  const admin = createAdminClient();
  const threshold = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const { data: accounts } = await admin
    .from("instagram_accounts")
    .select("*")
    .eq("status", "active")
    .lt("token_expires_at", threshold);

  let refreshed = 0;
  for (const account of accounts ?? []) {
    try {
      const result = await ig.refreshLongLivedToken(getAccessToken(account));
      await admin
        .from("instagram_accounts")
        .update({
          access_token_encrypted: encryptSecret(result.access_token),
          token_expires_at: new Date(Date.now() + result.expires_in * 1000).toISOString(),
          last_error: null,
        })
        .eq("id", account.id);
      refreshed++;
    } catch (error) {
      await handleAccountApiError(account, error);
      await log({
        organizationId: account.organization_id,
        level: "error",
        source: "instagram",
        event: "token_refresh_failed",
        message: `Falha ao renovar token de @${account.username}: ${errorMessage(error)}`,
      });
    }
  }
  return { checked: accounts?.length ?? 0, refreshed };
}
