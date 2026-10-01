"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bot, CheckCheck, Clock, Hand, Loader2, Send, Sparkles, Workflow } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ContactAvatar } from "@/components/shared/contact-avatar";
import { markConversationRead, sendAgentMessage, suggestAiReply, updateConversation } from "@/server/actions/inbox-actions";
import { cn, formatShortTime } from "@/lib/utils";
import type { InboxConversation, InboxMessage } from "./inbox-view";

const SOURCE_LABEL: Record<InboxMessage["source"], { label: string; icon: typeof Bot } | null> = {
  contact: null,
  automation: { label: "Automação", icon: Workflow },
  ai: { label: "IA", icon: Bot },
  agent: { label: "Atendente", icon: Hand },
  comment_reply: { label: "Resposta ao comentário", icon: CheckCheck },
};

const WINDOW_MS = 24 * 60 * 60 * 1000;

type Props = {
  conversation: InboxConversation;
  messages: InboxMessage[];
  lastInboundAt: string | null;
  aiAutoReply: boolean;
};

export function ChatPanel({ conversation, messages, lastInboundAt, aiAutoReply }: Props) {
  const [text, setText] = useState("");
  const [sending, startSending] = useTransition();
  const [suggesting, startSuggesting] = useTransition();
  const [updating, startUpdating] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [now] = useState(() => Date.now());
  const windowOpen = lastInboundAt ? now - new Date(lastInboundAt).getTime() < WINDOW_MS : false;
  const botPaused = conversation.bot_paused_until ? new Date(conversation.bot_paused_until).getTime() > now : false;
  const title = conversation.contact.name ?? (conversation.contact.username ? `@${conversation.contact.username}` : "Contato");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  useEffect(() => {
    if (conversation.unread_count > 0) void markConversationRead(conversation.id);
  }, [conversation.id, conversation.unread_count]);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    startSending(async () => {
      const result = await sendAgentMessage(conversation.id, value);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setText("");
      router.refresh();
    });
  };

  const suggest = () =>
    startSuggesting(async () => {
      const result = await suggestAiReply(conversation.id);
      if (!result.ok) toast.error(result.error);
      else setText(result.data.text);
    });

  const patch = (p: Parameters<typeof updateConversation>[1], message: string) =>
    startUpdating(async () => {
      const result = await updateConversation(conversation.id, p);
      if (!result.ok) toast.error(result.error);
      else toast.success(message);
      router.refresh();
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <ContactAvatar contact={conversation.contact} className="size-9" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.contact.username && `@${conversation.contact.username} · `}via @{conversation.account?.username}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="ai-toggle" className="text-xs text-muted-foreground">IA</Label>
          <Switch
            id="ai-toggle"
            disabled={updating}
            checked={conversation.ai_enabled}
            onCheckedChange={(aiEnabled) => patch({ aiEnabled }, aiEnabled ? "IA ativada nesta conversa." : "IA desativada nesta conversa.")}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={updating}
          onClick={() =>
            patch({ status: conversation.status === "open" ? "closed" : "open" }, conversation.status === "open" ? "Conversa fechada." : "Conversa reaberta.")
          }
        >
          {conversation.status === "open" ? "Fechar" : "Reabrir"}
        </Button>
      </div>

      {botPaused && (
        <div className="flex items-center justify-between gap-2 border-b bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <span className="flex items-center gap-1.5">
            <Hand className="size-3.5" /> Atendimento humano: automações e IA pausadas até {formatShortTime(conversation.bot_paused_until!)}.
          </span>
          <button className="font-medium underline" onClick={() => patch({ resumeBot: true }, "Bot retomado.")}>Retomar bot</button>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 px-4 py-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>}
        {messages.map((message) => {
          const outbound = message.direction === "outbound";
          const source = SOURCE_LABEL[message.source];
          return (
            <div key={message.id} className={cn("flex flex-col", outbound ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm shadow-sm",
                  outbound ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-background",
                  message.error && "bg-destructive/10 text-destructive",
                )}
              >
                {message.text ?? <span className="italic opacity-70">[anexo]</span>}
              </div>
              <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                {source && (
                  <span className="flex items-center gap-1">
                    <source.icon className="size-3" /> {source.label} ·
                  </span>
                )}
                {formatShortTime(message.created_at)}
                {message.error && (
                  <span className="flex items-center gap-1 text-destructive" title={message.error}>
                    <AlertTriangle className="size-3" /> não entregue
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-background p-3">
        {!windowOpen && (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <Clock className="size-3.5" /> Fora da janela de 24h: a Meta só permite responder depois que o contato enviar uma nova mensagem.
          </p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Escreva uma resposta... (Enter envia, Shift+Enter quebra linha)"
            rows={2}
            maxLength={1000}
            className="min-h-[44px] resize-none"
          />
          <div className="flex flex-col gap-1.5">
            <Button type="button" size="icon" variant="outline" onClick={suggest} disabled={suggesting} aria-label="Sugerir resposta com IA" title="Sugerir com IA">
              {suggesting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            </Button>
            <Button type="button" size="icon" onClick={send} disabled={sending || !text.trim()} aria-label="Enviar">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
        </div>
        {aiAutoReply && conversation.ai_enabled && !botPaused && (
          <p className="mt-2 text-[11px] text-muted-foreground">A IA responde automaticamente mensagens sem automação correspondente.</p>
        )}
      </div>
    </div>
  );
}
