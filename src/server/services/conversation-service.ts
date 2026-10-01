import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Contact } from "@/server/services/contact-service";
import type { Enums, Json, Tables } from "@/types/database";

export type Conversation = Tables<"conversations">;

export async function getOrCreateConversation(contact: Contact): Promise<Conversation> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("conversations")
    .select("*")
    .eq("instagram_account_id", contact.instagram_account_id)
    .eq("contact_id", contact.id)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await admin
    .from("conversations")
    .upsert(
      {
        organization_id: contact.organization_id,
        instagram_account_id: contact.instagram_account_id,
        contact_id: contact.id,
      },
      { onConflict: "instagram_account_id,contact_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

type RecordMessageInput = {
  conversation: Conversation;
  direction: Enums<"message_direction">;
  source: Enums<"message_source">;
  text: string | null;
  mid?: string | null;
  payload?: Json;
  automationId?: string | null;
  sentBy?: string | null;
  error?: string | null;
};

/**
 * Persiste uma mensagem de forma idempotente (mid único) e atualiza
 * o resumo da conversa. Retorna null se a mensagem já existia (webhook repetido).
 */
export async function recordMessage(input: RecordMessageInput) {
  const admin = createAdminClient();
  const { conversation } = input;

  const { data, error } = await admin
    .from("messages")
    .insert({
      organization_id: conversation.organization_id,
      conversation_id: conversation.id,
      contact_id: conversation.contact_id,
      direction: input.direction,
      source: input.source,
      text: input.text,
      mid: input.mid ?? null,
      payload: input.payload ?? {},
      automation_id: input.automationId ?? null,
      sent_by: input.sentBy ?? null,
      error: input.error ?? null,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return null; // duplicado
    throw error;
  }

  const isInbound = input.direction === "inbound";
  await admin
    .from("conversations")
    .update({
      last_message_at: data.created_at,
      last_message_preview: (input.text ?? "[mídia]").slice(0, 140),
      status: isInbound ? "open" : conversation.status,
      unread_count: isInbound ? conversation.unread_count + 1 : conversation.unread_count,
    })
    .eq("id", conversation.id);

  return data;
}

export async function messageExists(mid: string) {
  const { count } = await createAdminClient()
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("mid", mid);
  return (count ?? 0) > 0;
}

export function isBotPaused(conversation: Conversation) {
  return Boolean(conversation.bot_paused_until && new Date(conversation.bot_paused_until) > new Date());
}

/** Pausa automações/IA quando um humano assume a conversa (human takeover). */
export async function pauseBot(conversation: Conversation, minutes: number) {
  if (minutes <= 0) return;
  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  await createAdminClient().from("conversations").update({ bot_paused_until: until }).eq("id", conversation.id);
}

export async function getRecentMessages(conversationId: string, limit: number) {
  const { data } = await createAdminClient()
    .from("messages")
    .select("direction, text, created_at")
    .eq("conversation_id", conversationId)
    .not("text", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).reverse();
}
