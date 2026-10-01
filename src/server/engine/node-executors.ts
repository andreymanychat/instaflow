import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueJob } from "@/server/services/job-queue";
import { replyPubliclyToComment, sendToContact } from "@/server/services/messaging-service";
import {
  addTagToContact,
  firstName,
  getContactTagIds,
  refreshFollowerStatus,
  removeTagFromContact,
} from "@/server/services/contact-service";
import { generateAiReply } from "@/server/services/ai-service";
import { log } from "@/server/services/logger";
import { normalizeText, renderTemplate, type TemplateVars } from "@/server/engine/text";
import type { RunState, StepResult } from "@/server/engine/run-context";
import type {
  AiReplyNodeData,
  CommentReplyNodeData,
  ConditionNodeData,
  ConditionRule,
  DelayNodeData,
  FlowNode,
  FlowNodeType,
  MessageNodeData,
  TagNodeData,
} from "@/types/flow";

/** Delays curtos rodam na própria requisição; acima disso vão para a fila. */
const INLINE_DELAY_MAX_MS = 15_000;

const UNIT_MS = { seconds: 1_000, minutes: 60_000, hours: 3_600_000, days: 86_400_000 } as const;

type Executor = (node: FlowNode, state: RunState) => Promise<StepResult>;

export function templateVars(state: RunState): TemplateVars {
  return {
    first_name: firstName(state.contact),
    name: state.contact.name ?? state.contact.username ?? "",
    username: state.contact.username ? `@${state.contact.username}` : "",
    last_text: state.context.trigger.text,
  };
}

/** Consome a resposta privada do comentário na primeira DM do fluxo. */
function takeCommentRecipient(state: RunState): string | null {
  const { trigger } = state.context;
  if (!trigger.commentId || state.context.privateReplyUsed) return null;
  state.context.privateReplyUsed = true;
  return trigger.commentId;
}

async function markCommentFlag(state: RunState, flag: "replied" | "private_replied") {
  const commentId = state.context.trigger.commentId;
  if (!commentId) return;
  const patch = flag === "replied" ? { replied: true } : { private_replied: true };
  await createAdminClient().from("comments").update(patch).eq("comment_id", commentId);
}

export const buttonPayload = (runId: string, nodeId: string, buttonId: string) => `r:${runId}:${nodeId}:${buttonId}`;

export function parseButtonPayload(payload: string) {
  const match = /^r:([0-9a-f-]{36}):([^:]+):(.+)$/.exec(payload);
  return match ? { runId: match[1], nodeId: match[2], buttonId: match[3] } : null;
}

const executeMessage: Executor = async (node, state) => {
  const data = node.data as MessageNodeData;
  const text = renderTemplate(data.text, templateVars(state));
  if (!text) return { kind: "continue" };

  const quickReplies = (data.quickReplies ?? [])
    .filter((b) => b.title.trim())
    .map((b) => ({ ...b, payload: buttonPayload(state.run.id, node.id, b.id) }));

  const commentId = takeCommentRecipient(state);
  const result = await sendToContact({
    account: state.account,
    contact: state.contact,
    conversation: state.conversation,
    content: { text, quickReplies, linkButtons: (data.linkButtons ?? []).filter((b) => b.url && b.title) },
    source: "automation",
    automationId: state.automation.id,
    commentId,
  });
  if (!result.ok) return { kind: "fail", error: result.error };
  if (commentId) await markCommentFlag(state, "private_replied");

  return quickReplies.length > 0 ? { kind: "halt", status: "waiting_input" } : { kind: "continue" };
};

const executeCommentReply: Executor = async (node, state) => {
  const data = node.data as CommentReplyNodeData;
  const commentId = state.context.trigger.commentId;
  if (!commentId) return { kind: "continue" }; // gatilho não foi comentário: passo ignorado

  const variations = (data.texts ?? []).map((t) => t.trim()).filter(Boolean);
  if (variations.length === 0) return { kind: "continue" };

  const text = renderTemplate(variations[Math.floor(Math.random() * variations.length)], templateVars(state));
  const result = await replyPubliclyToComment(state.account, commentId, text);
  if (result.ok) await markCommentFlag(state, "replied");
  // Falha na resposta pública não impede o envio da DM.
  return { kind: "continue" };
};

const executeDelay: Executor = async (node, state) => {
  const data = node.data as DelayNodeData;
  const ms = Math.max(0, Number(data.amount) || 0) * UNIT_MS[data.unit ?? "seconds"];
  if (ms === 0) return { kind: "continue" };

  if (ms <= INLINE_DELAY_MAX_MS) {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return { kind: "continue" };
  }

  const nextNodeId = state.graph.next(node.id);
  if (!nextNodeId) return { kind: "halt", status: "completed" };

  await enqueueJob({
    type: "resume_run",
    payload: { runId: state.run.id, nodeId: nextNodeId },
    runAt: new Date(Date.now() + ms),
    organizationId: state.automation.organization_id,
  });
  return { kind: "halt", status: "waiting_delay" };
};

async function evaluateRule(rule: ConditionRule, state: RunState): Promise<boolean> {
  switch (rule.field) {
    case "tag": {
      state.tagIds ??= await getContactTagIds(state.contact.id);
      const has = state.tagIds.includes(rule.value);
      return rule.operator === "not_has" ? !has : has;
    }
    case "is_follower": {
      const follows = await refreshFollowerStatus(state.account, state.contact);
      return rule.operator === "is_false" ? follows === false : follows === true;
    }
    case "message_text":
    case "username": {
      const subject = normalizeText(
        rule.field === "username" ? (state.contact.username ?? "") : state.context.trigger.text,
      );
      const value = normalizeText(rule.value ?? "");
      if (rule.operator === "equals") return subject === value;
      if (rule.operator === "not_contains") return !subject.includes(value);
      return subject.includes(value);
    }
  }
}

const executeCondition: Executor = async (node, state) => {
  const data = node.data as ConditionNodeData;
  const rules = data.rules ?? [];
  if (rules.length === 0) return { kind: "continue", handle: "true" };

  const results: boolean[] = [];
  for (const rule of rules) results.push(await evaluateRule(rule, state));
  const passed = data.match === "any" ? results.some(Boolean) : results.every(Boolean);
  return { kind: "continue", handle: passed ? "true" : "false" };
};

const executeTag =
  (action: "add" | "remove"): Executor =>
  async (node, state) => {
    const { tagId } = node.data as TagNodeData;
    if (!tagId) return { kind: "continue" };
    if (action === "add") await addTagToContact(state.contact, tagId);
    else await removeTagFromContact(state.contact, tagId);
    state.tagIds = undefined; // invalida cache para condições seguintes
    return { kind: "continue" };
  };

const executeAiReply: Executor = async (node, state) => {
  const data = node.data as AiReplyNodeData;
  const { trigger } = state.context;

  const result = await generateAiReply({
    organizationId: state.automation.organization_id,
    conversationId: state.conversation.id,
    contact: state.contact,
    promptId: data.promptId,
    extraInstructions: data.extraInstructions,
    // Em gatilho de comentário ainda não há histórico de DM: usamos o próprio comentário.
    overrideHistory: trigger.type === "comment" ? [{ role: "user", content: `(comentário em uma publicação) ${trigger.text}` }] : undefined,
  });

  if (!result.ok) {
    await log({
      organizationId: state.automation.organization_id,
      level: "warn",
      source: "automation",
      event: "ai_step_skipped",
      message: `Passo de IA não executado em "${state.automation.name}": ${result.error}`,
    });
    return { kind: "continue" };
  }

  const commentId = takeCommentRecipient(state);
  const sent = await sendToContact({
    account: state.account,
    contact: state.contact,
    conversation: state.conversation,
    content: { text: result.text },
    source: "ai",
    automationId: state.automation.id,
    commentId,
  });
  if (!sent.ok) return { kind: "fail", error: sent.error };
  if (commentId) await markCommentFlag(state, "private_replied");
  return { kind: "continue" };
};

/** Registro de executores: para adicionar um novo tipo de passo, basta registrá-lo aqui. */
export const NODE_EXECUTORS: Record<FlowNodeType, Executor> = {
  trigger: async () => ({ kind: "continue" }),
  message: executeMessage,
  comment_reply: executeCommentReply,
  delay: executeDelay,
  condition: executeCondition,
  add_tag: executeTag("add"),
  remove_tag: executeTag("remove"),
  ai_reply: executeAiReply,
};
