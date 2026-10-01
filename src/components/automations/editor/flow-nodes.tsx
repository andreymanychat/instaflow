"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRIGGER_LABELS } from "@/lib/automation-templates";
import { NODE_CATALOG } from "./node-catalog";
import { useEditor } from "./editor-context";
import type {
  AiReplyNodeData,
  CommentReplyNodeData,
  ConditionNodeData,
  DelayNodeData,
  FlowNodeType,
  MessageNodeData,
  TagNodeData,
} from "@/types/flow";
import { buttonHandle, NEXT_HANDLE } from "@/types/flow";

type AnyNode = Node<Record<string, unknown>, FlowNodeType>;

const handleClass = "!size-3 !border-2 !border-background !bg-primary";

function NodeShell({ type, selected, children, hasTarget = true, footer }: {
  type: FlowNodeType;
  selected: boolean;
  children: React.ReactNode;
  hasTarget?: boolean;
  footer?: React.ReactNode;
}) {
  const meta = NODE_CATALOG[type];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "w-64 rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow",
        selected ? "ring-2 ring-primary shadow-md" : "hover:shadow-md",
      )}
    >
      {hasTarget && <Handle type="target" position={Position.Top} className={handleClass} />}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className={cn("flex size-6 items-center justify-center rounded-md text-white", meta.accent)}>
          <Icon className="size-3.5" />
        </span>
        <span className="text-sm font-medium">{meta.label}</span>
      </div>
      <div className="space-y-2 px-3 py-2.5 text-xs text-muted-foreground">{children}</div>
      {footer}
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="italic text-amber-600">{children}</p>;

function NextHandle() {
  return <Handle id={NEXT_HANDLE} type="source" position={Position.Bottom} className={handleClass} />;
}

export function TriggerNode({ selected }: NodeProps<AnyNode>) {
  const { details } = useEditor();
  const { triggerConfig: cfg, triggerType } = details;
  return (
    <NodeShell type="trigger" selected={selected} hasTarget={false}>
      <p className="font-medium text-foreground">{TRIGGER_LABELS[triggerType]}</p>
      {triggerType !== "default_reply" &&
        (cfg.match === "any" ? (
          <p>Qualquer {triggerType === "comment" ? "comentário" : "mensagem"}</p>
        ) : cfg.keywords.length ? (
          <div className="flex flex-wrap gap-1">
            {cfg.keywords.slice(0, 6).map((k) => (
              <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-foreground">{k}</span>
            ))}
            {cfg.keywords.length > 6 && <span>+{cfg.keywords.length - 6}</span>}
          </div>
        ) : (
          <Empty>Defina as palavras-chave</Empty>
        ))}
      {triggerType === "comment" && (
        <p>{cfg.mediaIds.length ? `${cfg.mediaIds.length} publicação(ões) selecionada(s)` : "Em todas as publicações"}</p>
      )}
      <NextHandle />
    </NodeShell>
  );
}

export function MessageNode({ data, selected }: NodeProps<AnyNode>) {
  const d = data as unknown as MessageNodeData;
  const hasQuickReplies = d.quickReplies.length > 0;
  return (
    <NodeShell
      type="message"
      selected={selected}
      footer={
        (hasQuickReplies || d.linkButtons.length > 0) && (
          <div className="space-y-1.5 border-t px-3 py-2">
            {d.linkButtons.map((b) => (
              <div key={b.id} className="flex items-center justify-center gap-1 rounded-md border bg-muted/40 py-1 text-xs">
                <ExternalLink className="size-3" /> {b.title || "Link"}
              </div>
            ))}
            {d.quickReplies.map((b) => (
              <div key={b.id} className="relative rounded-md border border-primary/40 bg-primary/5 py-1 text-center text-xs font-medium text-primary">
                {b.title || "Botão"}
                <Handle id={buttonHandle(b.id)} type="source" position={Position.Right} className={cn(handleClass, "!-right-[19px]")} />
              </div>
            ))}
          </div>
        )
      }
    >
      {d.text ? <p className="line-clamp-4 whitespace-pre-wrap text-foreground">{d.text}</p> : <Empty>Mensagem vazia</Empty>}
      {hasQuickReplies && <p className="text-[11px]">Aguarda o clique em um botão ➜</p>}
      {!hasQuickReplies && <NextHandle />}
    </NodeShell>
  );
}

export function CommentReplyNode({ data, selected }: NodeProps<AnyNode>) {
  const d = data as unknown as CommentReplyNodeData;
  const texts = d.texts.filter(Boolean);
  return (
    <NodeShell type="comment_reply" selected={selected}>
      {texts.length ? (
        <>
          <p className="line-clamp-2 text-foreground">“{texts[0]}”</p>
          {texts.length > 1 && <p>+{texts.length - 1} variação(ões) sorteadas</p>}
        </>
      ) : (
        <Empty>Adicione uma resposta</Empty>
      )}
      <NextHandle />
    </NodeShell>
  );
}

const UNIT_LABEL = { seconds: "segundo(s)", minutes: "minuto(s)", hours: "hora(s)", days: "dia(s)" };

export function DelayNode({ data, selected }: NodeProps<AnyNode>) {
  const d = data as unknown as DelayNodeData;
  return (
    <NodeShell type="delay" selected={selected}>
      <p className="text-foreground">Aguardar {d.amount} {UNIT_LABEL[d.unit]}</p>
      <NextHandle />
    </NodeShell>
  );
}

const FIELD_LABEL = { tag: "Tag", message_text: "Mensagem", is_follower: "Segue o perfil", username: "Usuário" };

export function ConditionNode({ data, selected }: NodeProps<AnyNode>) {
  const d = data as unknown as ConditionNodeData;
  const { lookups } = useEditor();
  const describe = (r: ConditionNodeData["rules"][number]) => {
    if (r.field === "is_follower") return r.operator === "is_true" ? "Segue o perfil" : "Não segue o perfil";
    if (r.field === "tag") {
      const tag = lookups.tags.find((t) => t.id === r.value)?.name ?? "?";
      return `${r.operator === "has" ? "Tem" : "Não tem"} a tag “${tag}”`;
    }
    return `${FIELD_LABEL[r.field]} ${r.operator === "equals" ? "=" : r.operator === "not_contains" ? "não contém" : "contém"} “${r.value}”`;
  };

  return (
    <NodeShell
      type="condition"
      selected={selected}
      footer={
        <div className="grid grid-cols-2 border-t text-center text-xs font-medium">
          <div className="relative py-1.5 text-emerald-600">
            Sim
            <Handle id="true" type="source" position={Position.Bottom} className={cn(handleClass, "!bg-emerald-500")} />
          </div>
          <div className="relative border-l py-1.5 text-red-600">
            Não
            <Handle id="false" type="source" position={Position.Bottom} className={cn(handleClass, "!bg-red-500")} />
          </div>
        </div>
      }
    >
      {d.rules.length === 0 ? (
        <Empty>Sem regras (sempre “Sim”)</Empty>
      ) : (
        d.rules.map((r, i) => (
          <p key={r.id} className="text-foreground">
            {i > 0 && <span className="mr-1 font-semibold text-muted-foreground">{d.match === "all" ? "E" : "OU"}</span>}
            {describe(r)}
          </p>
        ))
      )}
    </NodeShell>
  );
}

function TagNodeBody({ data, selected, type }: NodeProps<AnyNode> & { type: "add_tag" | "remove_tag" }) {
  const d = data as unknown as TagNodeData;
  const { lookups } = useEditor();
  const tag = lookups.tags.find((t) => t.id === d.tagId);
  return (
    <NodeShell type={type} selected={selected}>
      {tag ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} /> {tag.name}
        </span>
      ) : (
        <Empty>Escolha uma tag</Empty>
      )}
      <NextHandle />
    </NodeShell>
  );
}

export const AddTagNode = (props: NodeProps<AnyNode>) => <TagNodeBody {...props} type="add_tag" />;
export const RemoveTagNode = (props: NodeProps<AnyNode>) => <TagNodeBody {...props} type="remove_tag" />;

export function AiReplyNode({ data, selected }: NodeProps<AnyNode>) {
  const d = data as unknown as AiReplyNodeData;
  const { lookups } = useEditor();
  const prompt = lookups.prompts.find((p) => p.id === d.promptId);
  return (
    <NodeShell type="ai_reply" selected={selected}>
      <p className="text-foreground">Prompt: {prompt?.name ?? "padrão da organização"}</p>
      {d.extraInstructions && <p className="line-clamp-2">+ {d.extraInstructions}</p>}
      <NextHandle />
    </NodeShell>
  );
}

export const NODE_TYPES = {
  trigger: TriggerNode,
  message: MessageNode,
  comment_reply: CommentReplyNode,
  delay: DelayNode,
  condition: ConditionNode,
  add_tag: AddTagNode,
  remove_tag: RemoveTagNode,
  ai_reply: AiReplyNode,
};
