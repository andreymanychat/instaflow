"use client";

import type { Node } from "@xyflow/react";
import { TriggerForm } from "./trigger-form";
import { AiReplyForm, CommentReplyForm, ConditionForm, DelayForm, MessageForm, TagForm } from "./node-forms";
import type { TriggerDetails } from "./editor-context";
import type { FlowNodeType } from "@/types/flow";

type Props = {
  node: Node<Record<string, unknown>, FlowNodeType>;
  details: TriggerDetails;
  onDetailsChange: (details: TriggerDetails) => void;
  onDataChange: (data: Record<string, unknown>) => void;
};

/** Escolhe o formulário de acordo com o tipo do nó selecionado. */
export function NodeConfig({ node, details, onDetailsChange, onDataChange }: Props) {
  const common = { data: node.data as never, onChange: (d: unknown) => onDataChange(d as Record<string, unknown>) };

  // `key` reinicia o estado interno dos formulários ao trocar de nó
  switch (node.type) {
    case "trigger":
      return <TriggerForm details={details} onChange={onDetailsChange} />;
    case "message":
      return <MessageForm key={node.id} {...common} />;
    case "comment_reply":
      return <CommentReplyForm key={node.id} {...common} />;
    case "delay":
      return <DelayForm key={node.id} {...common} />;
    case "condition":
      return <ConditionForm key={node.id} {...common} />;
    case "add_tag":
    case "remove_tag":
      return <TagForm key={node.id} {...common} />;
    case "ai_reply":
      return <AiReplyForm key={node.id} {...common} />;
  }
}
