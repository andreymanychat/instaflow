import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import * as ig from "@/server/integrations/instagram/client";
import { getAccessToken, type InstagramAccount } from "@/server/services/instagram-account-service";
import { checkLimit } from "@/server/services/plan-service";
import type { Tables } from "@/types/database";

export type Contact = Tables<"contacts">;

/**
 * Busca ou cria o contato de um usuário do Instagram (IGSID).
 * Na criação tenta enriquecer com o perfil público; a Meta só libera
 * esses dados depois que o usuário conversa com a conta, então falhas são ignoradas.
 */
export async function upsertContact(
  account: InstagramAccount,
  igsid: string,
  hints: { username?: string; inbound?: boolean } = {},
): Promise<Contact> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existing } = await admin
    .from("contacts")
    .select("*")
    .eq("instagram_account_id", account.id)
    .eq("igsid", igsid)
    .maybeSingle();

  if (existing) {
    const patch: Partial<Contact> = { last_interaction_at: now };
    if (hints.inbound) patch.last_inbound_at = now;
    if (hints.username && !existing.username) patch.username = hints.username;
    const shouldEnrich = hints.inbound && (!existing.name || existing.is_follower === null);
    if (shouldEnrich) Object.assign(patch, await fetchProfilePatch(account, igsid));

    const { data } = await admin.from("contacts").update(patch).eq("id", existing.id).select("*").single();
    return data ?? existing;
  }

  // Contato novo: respeita o limite de contatos do plano
  const quota = await checkLimit(account.organization_id, "contacts");
  if (!quota.allowed) {
    throw new Error(`Limite de ${quota.limit.toLocaleString("pt-BR")} contatos do plano atingido: novo contato ignorado. Faça upgrade em Assinatura.`);
  }

  const profilePatch = await fetchProfilePatch(account, igsid);
  const { data, error } = await admin
    .from("contacts")
    .upsert(
      {
        organization_id: account.organization_id,
        instagram_account_id: account.id,
        igsid,
        username: hints.username ?? null,
        last_interaction_at: now,
        last_inbound_at: hints.inbound ? now : null,
        ...profilePatch,
      },
      { onConflict: "instagram_account_id,igsid" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function fetchProfilePatch(account: InstagramAccount, igsid: string): Promise<Partial<Contact>> {
  try {
    const profile = await ig.getUserProfile(igsid, getAccessToken(account));
    return {
      ...(profile.username ? { username: profile.username } : {}),
      ...(profile.name ? { name: profile.name } : {}),
      ...(profile.profile_pic ? { profile_pic_url: profile.profile_pic } : {}),
      ...(profile.follower_count !== undefined ? { follower_count: profile.follower_count } : {}),
      ...(profile.is_user_follow_business !== undefined ? { is_follower: profile.is_user_follow_business } : {}),
    };
  } catch {
    return {};
  }
}

/** Atualiza o status "segue o perfil" em tempo real (usado pelas condições do fluxo). */
export async function refreshFollowerStatus(account: InstagramAccount, contact: Contact): Promise<boolean | null> {
  const patch = await fetchProfilePatch(account, contact.igsid);
  if (Object.keys(patch).length === 0) return contact.is_follower;
  await createAdminClient().from("contacts").update(patch).eq("id", contact.id);
  return patch.is_follower ?? contact.is_follower;
}

export async function getContactTagIds(contactId: string): Promise<string[]> {
  const { data } = await createAdminClient().from("contact_tags").select("tag_id").eq("contact_id", contactId);
  return (data ?? []).map((row) => row.tag_id);
}

export async function addTagToContact(contact: Contact, tagId: string) {
  await createAdminClient()
    .from("contact_tags")
    .upsert(
      { contact_id: contact.id, tag_id: tagId, organization_id: contact.organization_id },
      { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
    );
}

export async function removeTagFromContact(contact: Contact, tagId: string) {
  await createAdminClient().from("contact_tags").delete().eq("contact_id", contact.id).eq("tag_id", tagId);
}

export function firstName(contact: Pick<Contact, "name" | "username">) {
  return contact.name?.split(" ")[0] ?? contact.username ?? "";
}
