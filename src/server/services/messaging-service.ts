import "server-only";
import * as ig from "@/server/integrations/instagram/client";
import { MetaApiError } from "@/server/integrations/instagram/client";
import type { IgButton, IgOutgoingMessage, IgRecipient } from "@/server/integrations/instagram/types";
import {
  getAccessToken,
  handleAccountApiError,
  type InstagramAccount,
} from "@/server/services/instagram-account-service";
import { recordMessage, type Conversation } from "@/server/services/conversation-service";
import { errorMessage, log } from "@/server/services/logger";
import type { Contact } from "@/server/services/contact-service";
import type { Enums } from "@/types/database";
import type { LinkButton, QuickReplyButton } from "@/types/flow";

const MAX_TEXT_LENGTH = 1000;
const MAX_TEMPLATE_BUTTONS = 3;
const MAX_QUICK_REPLIES = 13;

export type OutgoingContent = {
  text: string;
  quickReplies?: (QuickReplyButton & { payload: string })[];
  linkButtons?: LinkButton[];
};

type SendParams = {
  account: InstagramAccount;
  contact: Contact;
  conversation: Conversation;
  content: OutgoingContent;
  source: Enums<"message_source">;
  automationId?: string | null;
  sentBy?: string | null;
  /** Quando presente, envia como "resposta privada" ao comentário (única forma de iniciar DM a partir de comentário). */
  commentId?: string | null;
};

/**
 * Monta a mensagem no formato da Meta:
 *  - só texto + respostas rápidas  -> text + quick_replies
 *  - com botões de link            -> button template (links + postbacks, máx. 3 botões)
 */
export function buildOutgoingMessage(content: OutgoingContent): IgOutgoingMessage {
  const text = content.text.slice(0, MAX_TEXT_LENGTH);
  const quickReplies = content.quickReplies ?? [];
  const links = content.linkButtons ?? [];

  if (links.length > 0) {
    const buttons: IgButton[] = [
      ...links.map((b) => ({ type: "web_url" as const, url: b.url, title: b.title.slice(0, 20) })),
      ...quickReplies.map((q) => ({ type: "postback" as const, title: q.title.slice(0, 20), payload: q.payload })),
    ].slice(0, MAX_TEMPLATE_BUTTONS);
    return { attachment: { type: "template", payload: { template_type: "button", text: text.slice(0, 640), buttons } } };
  }

  if (quickReplies.length > 0) {
    return {
      text,
      quick_replies: quickReplies.slice(0, MAX_QUICK_REPLIES).map((q) => ({
        content_type: "text" as const,
        title: q.title.slice(0, 20),
        payload: q.payload,
      })),
    };
  }

  return { text };
}

export async function sendToContact(params: SendParams) {
  const { account, contact, conversation, content, source } = params;
  const recipient: IgRecipient = params.commentId ? { comment_id: params.commentId } : { id: contact.igsid };
  const message = buildOutgoingMessage(content);
  const payload = JSON.parse(JSON.stringify({ message, via_comment: params.commentId ?? undefined }));

  try {
    const result = await ig.sendMessage(getAccessToken(account), recipient, message);
    await recordMessage({
      conversation,
      direction: "outbound",
      source,
      text: content.text,
      mid: result.message_id,
      payload,
      automationId: params.automationId,
      sentBy: params.sentBy,
    });
    return { ok: true as const, messageId: result.message_id };
  } catch (error) {
    await handleAccountApiError(account, error);
    const reason =
      error instanceof MetaApiError && error.isMessagingWindowError
        ? "Fora da janela de 24h da Meta: o contato precisa enviar uma mensagem antes."
        : errorMessage(error);

    await recordMessage({
      conversation,
      direction: "outbound",
      source,
      text: content.text,
      payload,
      automationId: params.automationId,
      sentBy: params.sentBy,
      error: reason,
    });
    await log({
      organizationId: account.organization_id,
      level: "error",
      source: "messaging",
      event: "send_failed",
      message: `Falha ao enviar DM para @${contact.username ?? contact.igsid}: ${reason}`,
      metadata: { contact_id: contact.id, automation_id: params.automationId ?? null },
    });
    return { ok: false as const, error: reason };
  }
}

export async function replyPubliclyToComment(account: InstagramAccount, commentId: string, text: string) {
  try {
    await ig.replyToComment(getAccessToken(account), commentId, text.slice(0, 2200));
    return { ok: true as const };
  } catch (error) {
    await handleAccountApiError(account, error);
    await log({
      organizationId: account.organization_id,
      level: "error",
      source: "messaging",
      event: "comment_reply_failed",
      message: `Falha ao responder comentário ${commentId}: ${errorMessage(error)}`,
    });
    return { ok: false as const, error: errorMessage(error) };
  }
}
