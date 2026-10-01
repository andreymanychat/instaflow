"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, safeAction, zodError } from "@/lib/action-result";
import { getOrgContext } from "@/server/auth/session";
import { sendToContact } from "@/server/services/messaging-service";
import { pauseBot } from "@/server/services/conversation-service";
import { generateAiReply } from "@/server/services/ai-service";

/** Carrega conversa + contato + conta garantindo que pertencem à organização ativa. */
async function loadConversationBundle(conversationId: string) {
  const { organization, user } = await getOrgContext();
  const admin = createAdminClient();

  const { data: conversation } = await admin
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("organization_id", organization.id)
    .maybeSingle();
  if (!conversation) throw new Error("Conversa não encontrada.");

  const [{ data: contact }, { data: account }] = await Promise.all([
    admin.from("contacts").select("*").eq("id", conversation.contact_id).single(),
    admin.from("instagram_accounts").select("*").eq("id", conversation.instagram_account_id).single(),
  ]);
  if (!contact || !account) throw new Error("Conversa incompleta.");
  if (account.status !== "active") throw new Error(`A conta @${account.username} precisa ser reconectada.`);

  return { organization, user, conversation, contact, account };
}

export async function sendAgentMessage(conversationId: string, text: string) {
  return safeAction(async () => {
    const parsed = z.string().trim().min(1, "Digite uma mensagem.").max(1000, "Máximo de 1000 caracteres.").safeParse(text);
    if (!parsed.success) return zodError(parsed.error);

    const { organization, user, conversation, contact, account } = await loadConversationBundle(conversationId);
    const result = await sendToContact({
      account,
      contact,
      conversation,
      content: { text: parsed.data },
      source: "agent",
      sentBy: user.id,
    });
    if (!result.ok) return fail(result.error);

    // Humano assumiu: bot fica pausado pelo tempo configurado
    await pauseBot(conversation, organization.human_takeover_minutes);
    return ok();
  });
}

export async function markConversationRead(conversationId: string) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    await supabase.from("conversations").update({ unread_count: 0 }).eq("id", conversationId).eq("organization_id", organization.id);
    return ok();
  });
}

export async function updateConversation(
  conversationId: string,
  patch: { status?: "open" | "closed"; aiEnabled?: boolean; resumeBot?: boolean },
) {
  return safeAction(async () => {
    const { supabase, organization } = await getOrgContext();
    const { error } = await supabase
      .from("conversations")
      .update({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.aiEnabled !== undefined ? { ai_enabled: patch.aiEnabled } : {}),
        ...(patch.resumeBot ? { bot_paused_until: null } : {}),
      })
      .eq("id", conversationId)
      .eq("organization_id", organization.id);
    if (error) return fail(error.message);
    revalidatePath("/inbox");
    return ok();
  });
}

/** Sugestão da IA para o atendente revisar antes de enviar. */
export async function suggestAiReply(conversationId: string) {
  return safeAction(async () => {
    const { organization, conversation, contact } = await loadConversationBundle(conversationId);
    const result = await generateAiReply({
      organizationId: organization.id,
      conversationId: conversation.id,
      contact,
      promptId: organization.default_ai_prompt_id,
    });
    if (!result.ok) return fail(result.error);
    return ok({ text: result.text });
  });
}
