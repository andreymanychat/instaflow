import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { findAccountByIgUserId, type InstagramAccount } from "@/server/services/instagram-account-service";
import { upsertContact, type Contact } from "@/server/services/contact-service";
import {
  getOrCreateConversation,
  isBotPaused,
  messageExists,
  pauseBot,
  recordMessage,
  type Conversation,
} from "@/server/services/conversation-service";
import { generateAiReply } from "@/server/services/ai-service";
import { sendToContact } from "@/server/services/messaging-service";
import { errorMessage, log } from "@/server/services/logger";
import { handleButtonClick, matchTypedButton, startAutomation } from "@/server/engine/flow-engine";
import { findMatchingAutomation, ranRecently, readTriggerConfig } from "@/server/engine/trigger-matcher";
import type { IgCommentValue, IgMessagingEvent, IgWebhookPayload } from "@/server/integrations/instagram/types";
import type { Json } from "@/types/database";

/**
 * Ponto de entrada do processamento assíncrono de webhooks.
 * Chamado via `after()` para que a Meta receba 200 imediatamente
 * (ela desativa webhooks que demoram ou falham repetidamente).
 */
export async function processWebhookPayload(payload: IgWebhookPayload) {
  if (payload.object !== "instagram") return;

  for (const entry of payload.entry ?? []) {
    const account = await findAccountByIgUserId(entry.id);
    const eventRow = await storeRawEvent(entry.id, account?.organization_id ?? null, entry);

    if (!account || account.status !== "active") {
      await markEvent(eventRow, account ? `Conta ${account.status}` : "Conta não conectada");
      continue;
    }

    try {
      for (const event of entry.messaging ?? []) await handleMessagingEvent(account, event);
      for (const change of entry.changes ?? []) {
        if (change.field === "comments" || change.field === "live_comments") await handleComment(account, change.value);
      }
      await markEvent(eventRow, null);
    } catch (error) {
      await markEvent(eventRow, errorMessage(error));
      await log({
        organizationId: account.organization_id,
        level: "error",
        source: "webhook",
        event: "processing_failed",
        message: `Erro ao processar webhook: ${errorMessage(error)}`,
      });
    }
  }
}

async function storeRawEvent(igUserId: string, organizationId: string | null, entry: unknown) {
  const { data } = await createAdminClient()
    .from("webhook_events")
    .insert({ ig_user_id: igUserId, organization_id: organizationId, object: "instagram", payload: entry as Json })
    .select("id")
    .single();
  return data?.id ?? null;
}

async function markEvent(id: number | null, error: string | null) {
  if (!id) return;
  await createAdminClient().from("webhook_events").update({ processed_at: new Date().toISOString(), error }).eq("id", id);
}

async function getOrgSettings(organizationId: string) {
  const { data } = await createAdminClient()
    .from("organizations")
    .select("ai_auto_reply_enabled, default_ai_prompt_id, human_takeover_minutes")
    .eq("id", organizationId)
    .single();
  return data ?? { ai_auto_reply_enabled: false, default_ai_prompt_id: null, human_takeover_minutes: 60 };
}

// ---------------------------------------------------------------------------
// Direct (mensagens)
// ---------------------------------------------------------------------------

async function handleMessagingEvent(account: InstagramAccount, event: IgMessagingEvent) {
  const isFromBusiness = event.sender.id === account.ig_user_id;

  if (event.message?.is_echo || isFromBusiness) {
    await handleEcho(account, event);
    return;
  }
  if (event.message?.is_deleted) return;

  const contact = await upsertContact(account, event.sender.id, { inbound: true });
  const conversation = await getOrCreateConversation(contact);

  if (event.postback) {
    await recordMessage({
      conversation,
      direction: "inbound",
      source: "contact",
      text: event.postback.title,
      mid: event.postback.mid ?? null,
      payload: { postback: event.postback },
    });
    if (!isBotPaused(conversation)) await handleButtonClick(event.postback.payload, contact, event.postback.title);
    return;
  }

  const message = event.message;
  if (!message) return; // read/reaction: ignorados

  const text = message.text ?? "";
  const saved = await recordMessage({
    conversation,
    direction: "inbound",
    source: "contact",
    text: text || null,
    mid: message.mid,
    payload: JSON.parse(JSON.stringify({ attachments: message.attachments, reply_to: message.reply_to, quick_reply: message.quick_reply })),
  });
  if (!saved) return; // webhook duplicado

  if (isBotPaused(conversation)) {
    await log({
      organizationId: account.organization_id,
      level: "debug",
      source: "webhook",
      event: "bot_paused",
      message: `Mensagem de @${contact.username ?? contact.igsid} ignorada pelo bot (atendimento humano ativo).`,
    });
    return;
  }

  if (message.quick_reply?.payload) {
    const handled = await handleButtonClick(message.quick_reply.payload, contact, text);
    if (handled) return;
  }
  if (text && (await matchTypedButton(contact, text))) return;

  await routeIncomingMessage(account, contact, conversation, text, Boolean(message.reply_to?.story));
}

/**
 * Ordem de prioridade (igual ao ManyChat):
 *  1. Resposta a story com automação dedicada
 *  2. Palavra-chave de DM
 *  3. IA (se habilitada na organização e na conversa)
 *  4. Resposta padrão (no máximo 1x a cada 24h por contato)
 */
async function routeIncomingMessage(
  account: InstagramAccount,
  contact: Contact,
  conversation: Conversation,
  text: string,
  isStoryReply: boolean,
) {
  if (isStoryReply) {
    const storyAutomation = await findMatchingAutomation(account, "story_reply", { text });
    if (storyAutomation) {
      await startAutomation({ automation: storyAutomation, account, contact, conversation, trigger: { type: "story_reply", text } });
      return;
    }
  }

  const keywordAutomation = text ? await findMatchingAutomation(account, "dm_keyword", { text }) : null;
  if (keywordAutomation) {
    await startAutomation({ automation: keywordAutomation, account, contact, conversation, trigger: { type: "dm_keyword", text } });
    return;
  }

  const settings = await getOrgSettings(account.organization_id);
  if (settings.ai_auto_reply_enabled && conversation.ai_enabled && text) {
    const reply = await generateAiReply({
      organizationId: account.organization_id,
      conversationId: conversation.id,
      contact,
      promptId: settings.default_ai_prompt_id,
    });
    if (reply.ok) {
      await sendToContact({ account, contact, conversation, content: { text: reply.text }, source: "ai" });
      return;
    }
  }

  const defaultAutomation = await findMatchingAutomation(account, "default_reply", { text });
  if (defaultAutomation && !(await ranRecently(defaultAutomation.id, contact.id))) {
    await startAutomation({ automation: defaultAutomation, account, contact, conversation, trigger: { type: "default_reply", text } });
  }
}

/**
 * Eco = mensagem enviada PELA conta. Se não fomos nós (mid desconhecido),
 * foi um humano respondendo pelo app do Instagram: registramos e pausamos o bot.
 */
async function handleEcho(account: InstagramAccount, event: IgMessagingEvent) {
  const mid = event.message?.mid;
  if (!mid) return;

  // O eco pode chegar antes de gravarmos o message_id retornado pela API.
  await new Promise((resolve) => setTimeout(resolve, 2_500));
  if (await messageExists(mid)) return;

  const contact = await upsertContact(account, event.recipient.id);
  const conversation = await getOrCreateConversation(contact);
  const saved = await recordMessage({
    conversation,
    direction: "outbound",
    source: "agent",
    text: event.message?.text ?? null,
    mid,
    payload: { echo: true },
  });
  if (!saved) return;

  const settings = await getOrgSettings(account.organization_id);
  await pauseBot(conversation, settings.human_takeover_minutes);
}

// ---------------------------------------------------------------------------
// Comentários
// ---------------------------------------------------------------------------

async function handleComment(account: InstagramAccount, value: IgCommentValue) {
  if (!value?.id || value.from?.id === account.ig_user_id) return; // ignora respostas da própria conta

  const admin = createAdminClient();
  const contact = await upsertContact(account, value.from.id, { username: value.from.username });

  const { error } = await admin.from("comments").insert({
    organization_id: account.organization_id,
    instagram_account_id: account.id,
    contact_id: contact.id,
    comment_id: value.id,
    parent_id: value.parent_id ?? null,
    media_id: value.media?.id ?? null,
    media_product_type: value.media?.media_product_type ?? null,
    text: value.text,
  });
  if (error?.code === "23505") return; // webhook duplicado
  if (error) throw error;

  const automation = await findMatchingAutomation(account, "comment", { text: value.text ?? "", mediaId: value.media?.id });
  if (!automation) return;

  if (readTriggerConfig(automation).onlyFirstComment && value.media?.id) {
    const { count } = await admin
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("contact_id", contact.id)
      .eq("media_id", value.media.id);
    if ((count ?? 0) > 1) return;
  }

  await startAutomation({
    automation,
    account,
    contact,
    trigger: { type: "comment", text: value.text ?? "", commentId: value.id, mediaId: value.media?.id },
  });
}
