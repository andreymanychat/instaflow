/**
 * Modelo de dados dos fluxos visuais. É compartilhado entre o editor
 * (React Flow no cliente) e o motor de execução (servidor), por isso
 * não depende de nenhuma biblioteca.
 */

export type FlowNodeType =
  | "trigger"
  | "message"
  | "comment_reply"
  | "delay"
  | "condition"
  | "add_tag"
  | "remove_tag"
  | "ai_reply";

export interface QuickReplyButton {
  id: string;
  title: string;
}

export interface LinkButton {
  id: string;
  title: string;
  url: string;
}

export interface MessageNodeData {
  text: string;
  /** Respostas rápidas: cada uma gera uma saída (handle `btn:<id>`) e pausa o fluxo aguardando o clique. */
  quickReplies: QuickReplyButton[];
  /** Botões de link (web_url). Enviados como button template. */
  linkButtons: LinkButton[];
}

export interface CommentReplyNodeData {
  /** Uma variação é sorteada a cada execução para parecer mais natural. */
  texts: string[];
}

export type DelayUnit = "seconds" | "minutes" | "hours" | "days";

export interface DelayNodeData {
  amount: number;
  unit: DelayUnit;
}

export type ConditionField = "tag" | "message_text" | "is_follower" | "username";
export type ConditionOperator = "has" | "not_has" | "contains" | "not_contains" | "equals" | "is_true" | "is_false";

export interface ConditionRule {
  id: string;
  field: ConditionField;
  operator: ConditionOperator;
  value: string;
}

export interface ConditionNodeData {
  match: "all" | "any";
  rules: ConditionRule[];
}

export interface TagNodeData {
  tagId: string | null;
}

export interface AiReplyNodeData {
  promptId: string | null;
  /** Instrução extra somada ao prompt do sistema apenas neste passo. */
  extraInstructions: string;
}

export interface FlowNodeDataMap {
  trigger: Record<string, never>;
  message: MessageNodeData;
  comment_reply: CommentReplyNodeData;
  delay: DelayNodeData;
  condition: ConditionNodeData;
  add_tag: TagNodeData;
  remove_tag: TagNodeData;
  ai_reply: AiReplyNodeData;
}

export interface FlowNode<T extends FlowNodeType = FlowNodeType> {
  id: string;
  type: T;
  position: { x: number; y: number };
  data: FlowNodeDataMap[T];
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /** "next" (padrão), "true"/"false" em condições, "btn:<id>" em respostas rápidas. */
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface FlowDefinition {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type KeywordMatch = "contains" | "exact" | "starts_with" | "any";

export interface TriggerConfig {
  keywords: string[];
  match: KeywordMatch;
  /** Apenas para gatilho de comentário: vazio = todas as publicações. */
  mediaIds: string[];
  /** Responder apenas ao primeiro comentário de cada contato naquela publicação. */
  onlyFirstComment: boolean;
}

export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = {
  keywords: [],
  match: "contains",
  mediaIds: [],
  onlyFirstComment: false,
};

export const NEXT_HANDLE = "next";
export const buttonHandle = (buttonId: string) => `btn:${buttonId}`;
