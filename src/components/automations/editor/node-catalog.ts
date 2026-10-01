import { Bot, Clock, GitBranch, MessageCircle, MessageSquareReply, Tag, TagsIcon, Zap, type LucideIcon } from "lucide-react";
import type { FlowNodeDataMap, FlowNodeType } from "@/types/flow";

export type NodeMeta<T extends FlowNodeType = FlowNodeType> = {
  type: T;
  label: string;
  description: string;
  icon: LucideIcon;
  /** classes Tailwind do cabeçalho do nó */
  accent: string;
  defaultData: () => FlowNodeDataMap[T];
  addable: boolean;
};

export const shortId = () => Math.random().toString(36).slice(2, 10);

export const NODE_CATALOG: { [K in FlowNodeType]: NodeMeta<K> } = {
  trigger: {
    type: "trigger",
    label: "Gatilho",
    description: "Quando a automação começa",
    icon: Zap,
    accent: "bg-amber-500",
    defaultData: () => ({}),
    addable: false,
  },
  message: {
    type: "message",
    label: "Enviar mensagem",
    description: "Texto, respostas rápidas e botões de link",
    icon: MessageCircle,
    accent: "bg-violet-600",
    defaultData: () => ({ text: "", quickReplies: [], linkButtons: [] }),
    addable: true,
  },
  comment_reply: {
    type: "comment_reply",
    label: "Responder comentário",
    description: "Resposta pública no post (só em gatilho de comentário)",
    icon: MessageSquareReply,
    accent: "bg-pink-600",
    defaultData: () => ({ texts: ["Te enviei no direct! 📩"] }),
    addable: true,
  },
  delay: {
    type: "delay",
    label: "Aguardar",
    description: "Pausa antes do próximo passo",
    icon: Clock,
    accent: "bg-slate-500",
    defaultData: () => ({ amount: 5, unit: "seconds" }),
    addable: true,
  },
  condition: {
    type: "condition",
    label: "Condição",
    description: "Divide o fluxo em Sim / Não",
    icon: GitBranch,
    accent: "bg-sky-600",
    defaultData: () => ({ match: "all", rules: [] }),
    addable: true,
  },
  add_tag: {
    type: "add_tag",
    label: "Adicionar tag",
    description: "Marca o contato para segmentação",
    icon: Tag,
    accent: "bg-emerald-600",
    defaultData: () => ({ tagId: null }),
    addable: true,
  },
  remove_tag: {
    type: "remove_tag",
    label: "Remover tag",
    description: "Remove uma tag do contato",
    icon: TagsIcon,
    accent: "bg-orange-600",
    defaultData: () => ({ tagId: null }),
    addable: true,
  },
  ai_reply: {
    type: "ai_reply",
    label: "Resposta com IA",
    description: "Gera e envia uma resposta com OpenAI",
    icon: Bot,
    accent: "bg-fuchsia-600",
    defaultData: () => ({ promptId: null, extraInstructions: "" }),
    addable: true,
  },
};

export const ADDABLE_NODES = Object.values(NODE_CATALOG).filter((n) => n.addable);
