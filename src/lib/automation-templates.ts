import type { Enums } from "@/types/database";
import type { FlowDefinition, TriggerConfig } from "@/types/flow";
import { DEFAULT_TRIGGER_CONFIG } from "@/types/flow";

export type AutomationTemplateId = "blank" | "comment_to_dm" | "follow_gate" | "dm_keyword" | "story_reply" | "ai_default";

export type AutomationTemplate = {
  id: AutomationTemplateId;
  name: string;
  description: string;
  triggerType: Enums<"trigger_type">;
  triggerConfig: TriggerConfig;
  flow: FlowDefinition;
};

const trigger = { id: "trigger", type: "trigger" as const, position: { x: 0, y: 0 }, data: {} };

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "comment_to_dm",
    name: "Comentário → Direct",
    description: "Quem comentar a palavra-chave recebe uma resposta pública e um link no Direct.",
    triggerType: "comment",
    triggerConfig: { ...DEFAULT_TRIGGER_CONFIG, keywords: ["quero", "link"] },
    flow: {
      nodes: [
        trigger,
        {
          id: "reply",
          type: "comment_reply",
          position: { x: 0, y: 160 },
          data: { texts: ["Te chamei no direct! 📩", "Enviei no seu direct 😉", "Corre no direct que te mandei! 🚀"] },
        },
        {
          id: "welcome",
          type: "message",
          position: { x: 0, y: 340 },
          data: {
            text: "Oi {{first_name}}! Que bom que você se interessou 😊 Toque no botão abaixo para receber o link.",
            quickReplies: [{ id: "b1", title: "Quero o link" }],
            linkButtons: [],
          },
        },
        {
          id: "link",
          type: "message",
          position: { x: 0, y: 560 },
          data: {
            text: "Aqui está! Qualquer dúvida é só responder esta mensagem.",
            quickReplies: [],
            linkButtons: [{ id: "l1", title: "Acessar", url: "https://exemplo.com" }],
          },
        },
        { id: "tag", type: "add_tag", position: { x: 0, y: 760 }, data: { tagId: null } },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "reply", sourceHandle: "next" },
        { id: "e2", source: "reply", target: "welcome", sourceHandle: "next" },
        { id: "e3", source: "welcome", target: "link", sourceHandle: "btn:b1" },
        { id: "e4", source: "link", target: "tag", sourceHandle: "next" },
      ],
    },
  },
  {
    id: "follow_gate",
    name: "Link só para seguidores",
    description: "Envia o link apenas para quem segue o perfil; os demais recebem um convite para seguir.",
    triggerType: "comment",
    triggerConfig: { ...DEFAULT_TRIGGER_CONFIG, keywords: ["eu quero"] },
    flow: {
      nodes: [
        trigger,
        {
          id: "ask",
          type: "message",
          position: { x: 0, y: 160 },
          data: {
            text: "Oi {{first_name}}! Para liberar o conteúdo, toque no botão 👇",
            quickReplies: [{ id: "b1", title: "Liberar conteúdo" }],
            linkButtons: [],
          },
        },
        {
          id: "check",
          type: "condition",
          position: { x: 0, y: 380 },
          data: { match: "all", rules: [{ id: "r1", field: "is_follower", operator: "is_true", value: "" }] },
        },
        {
          id: "yes",
          type: "message",
          position: { x: -220, y: 600 },
          data: {
            text: "Obrigado por nos seguir! Aqui está 🎁",
            quickReplies: [],
            linkButtons: [{ id: "l1", title: "Abrir", url: "https://exemplo.com" }],
          },
        },
        {
          id: "no",
          type: "message",
          position: { x: 220, y: 600 },
          data: {
            text: "Parece que você ainda não segue o perfil 🥺 Siga e toque novamente no botão.",
            quickReplies: [{ id: "b2", title: "Já segui!" }],
            linkButtons: [],
          },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "ask", sourceHandle: "next" },
        { id: "e2", source: "ask", target: "check", sourceHandle: "btn:b1" },
        { id: "e3", source: "check", target: "yes", sourceHandle: "true" },
        { id: "e4", source: "check", target: "no", sourceHandle: "false" },
        { id: "e5", source: "no", target: "check", sourceHandle: "btn:b2" },
      ],
    },
  },
  {
    id: "dm_keyword",
    name: "Palavra-chave no Direct",
    description: "Responde automaticamente quando alguém envia uma palavra-chave por DM.",
    triggerType: "dm_keyword",
    triggerConfig: { ...DEFAULT_TRIGGER_CONFIG, keywords: ["preço", "valor"] },
    flow: {
      nodes: [
        trigger,
        {
          id: "m1",
          type: "message",
          position: { x: 0, y: 160 },
          data: { text: "Oi {{first_name}}! Vou te passar os valores 😊", quickReplies: [], linkButtons: [] },
        },
        { id: "d1", type: "delay", position: { x: 0, y: 340 }, data: { amount: 3, unit: "seconds" } },
        {
          id: "m2",
          type: "message",
          position: { x: 0, y: 480 },
          data: { text: "Nosso plano começa em R$ 97/mês. Quer falar com um especialista?", quickReplies: [{ id: "b1", title: "Sim" }, { id: "b2", title: "Agora não" }], linkButtons: [] },
        },
      ],
      edges: [
        { id: "e1", source: "trigger", target: "m1", sourceHandle: "next" },
        { id: "e2", source: "m1", target: "d1", sourceHandle: "next" },
        { id: "e3", source: "d1", target: "m2", sourceHandle: "next" },
      ],
    },
  },
  {
    id: "story_reply",
    name: "Resposta a Stories",
    description: "Agradece automaticamente quem responde aos seus stories.",
    triggerType: "story_reply",
    triggerConfig: { ...DEFAULT_TRIGGER_CONFIG, match: "any" },
    flow: {
      nodes: [
        trigger,
        {
          id: "m1",
          type: "message",
          position: { x: 0, y: 160 },
          data: { text: "Valeu por responder o story, {{first_name}}! 💜", quickReplies: [], linkButtons: [] },
        },
      ],
      edges: [{ id: "e1", source: "trigger", target: "m1", sourceHandle: "next" }],
    },
  },
  {
    id: "ai_default",
    name: "Resposta padrão com IA",
    description: "Quando nenhuma palavra-chave casar, a IA responde usando seu prompt.",
    triggerType: "default_reply",
    triggerConfig: { ...DEFAULT_TRIGGER_CONFIG, match: "any" },
    flow: {
      nodes: [trigger, { id: "ai", type: "ai_reply", position: { x: 0, y: 160 }, data: { promptId: null, extraInstructions: "" } }],
      edges: [{ id: "e1", source: "trigger", target: "ai", sourceHandle: "next" }],
    },
  },
  {
    id: "blank",
    name: "Em branco",
    description: "Comece do zero com apenas o gatilho.",
    triggerType: "dm_keyword",
    triggerConfig: DEFAULT_TRIGGER_CONFIG,
    flow: { nodes: [trigger], edges: [] },
  },
];

export const TRIGGER_LABELS: Record<Enums<"trigger_type">, string> = {
  comment: "Comentário em post/reel",
  dm_keyword: "Palavra-chave no Direct",
  story_reply: "Resposta a story",
  default_reply: "Resposta padrão",
};
