import type { Tables } from "@/types/database";
import type { FlowGraph } from "@/server/engine/flow-graph";
import type { InstagramAccount } from "@/server/services/instagram-account-service";
import type { Contact } from "@/server/services/contact-service";
import type { Conversation } from "@/server/services/conversation-service";

export type TriggerContext = {
  type: Tables<"automations">["trigger_type"] | "button";
  /** Texto que disparou/retomou o fluxo (comentário, DM ou título do botão). */
  text: string;
  commentId?: string;
  mediaId?: string;
};

/** Estado persistido em automation_runs.context entre execuções (delays, cliques). */
export type RunContext = {
  trigger: TriggerContext;
  /** A Meta permite apenas UMA resposta privada por comentário. */
  privateReplyUsed?: boolean;
};

/** Estado em memória de uma execução do fluxo. */
export type RunState = {
  run: Tables<"automation_runs">;
  automation: Tables<"automations">;
  graph: FlowGraph;
  account: InstagramAccount;
  contact: Contact;
  conversation: Conversation;
  context: RunContext;
  tagIds?: string[];
};

export type StepResult =
  | { kind: "continue"; handle?: string }
  | { kind: "halt"; status: "waiting_delay" | "waiting_input" | "completed" }
  | { kind: "fail"; error: string };
