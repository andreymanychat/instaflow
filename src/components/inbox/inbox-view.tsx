"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Inbox as InboxIcon, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ContactAvatar } from "@/components/shared/contact-avatar";
import { createClient } from "@/lib/supabase/client";
import { cn, formatShortTime } from "@/lib/utils";
import { ChatPanel } from "./chat-panel";
import { ContactPanel } from "./contact-panel";
import type { Json } from "@/types/database";

export type InboxConversation = {
  id: string;
  status: "open" | "closed";
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
  ai_enabled: boolean;
  bot_paused_until: string | null;
  contact: { id: string; username: string | null; name: string | null; profile_pic_url: string | null };
  account: { username: string } | null;
};

export type InboxMessage = {
  id: string;
  direction: "inbound" | "outbound";
  source: "contact" | "automation" | "ai" | "agent" | "comment_reply";
  text: string | null;
  error: string | null;
  created_at: string;
  payload: Json;
};

type Props = {
  organizationId: string;
  conversations: InboxConversation[];
  selected: {
    conversation: InboxConversation;
    messages: InboxMessage[];
    contact: { id: string; igsid: string; is_follower: boolean | null; follower_count: number | null; created_at: string; last_inbound_at: string | null };
    tagIds: string[];
  } | null;
  tags: { id: string; name: string; color: string }[];
  filters: { status: "open" | "closed" | "all"; search: string };
  aiAutoReply: boolean;
};

/** Atualiza a tela quando chegam mensagens (Supabase Realtime respeitando RLS). */
function useRealtimeRefresh(organizationId: string) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300);
    };
    const channel = supabase
      .channel(`inbox-${organizationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `organization_id=eq.${organizationId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `organization_id=eq.${organizationId}` }, refresh)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [organizationId, router]);
}

export function InboxView({ organizationId, conversations, selected, tags, filters, aiAutoReply }: Props) {
  useRealtimeRefresh(organizationId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefWith = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    return `${pathname}?${params}`;
  };

  return (
    <div className="flex h-svh min-h-0">
      {/* Lista de conversas */}
      <section className={cn("flex w-full flex-col border-r md:w-80 md:shrink-0", selected && "hidden md:flex")}>
        <div className="space-y-3 border-b p-3">
          <div className="flex items-center gap-2">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">Caixa de entrada</h1>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q")?.toString() ?? "";
              router.push(hrefWith({ q: q || null, c: null }));
            }}
          >
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input name="q" defaultValue={filters.search} placeholder="Buscar contato" className="pl-8" />
            </div>
          </form>
          <Tabs value={filters.status} onValueChange={(status) => router.push(hrefWith({ status, c: null }))}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="open">Abertas</TabsTrigger>
              <TabsTrigger value="closed">Fechadas</TabsTrigger>
              <TabsTrigger value="all">Todas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <InboxIcon className="size-8" />
              Nenhuma conversa por aqui. Quando alguém enviar uma DM para a conta conectada, ela aparece aqui em tempo real.
            </div>
          )}
          {conversations.map((conversation) => {
            const isActive = selected?.conversation.id === conversation.id;
            const title = conversation.contact.name ?? (conversation.contact.username ? `@${conversation.contact.username}` : "Contato");
            return (
              <Link
                key={conversation.id}
                href={hrefWith({ c: conversation.id })}
                className={cn("flex gap-3 border-b px-3 py-3 transition-colors hover:bg-muted/50", isActive && "bg-muted")}
              >
                <ContactAvatar contact={conversation.contact} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={cn("truncate text-sm", conversation.unread_count > 0 ? "font-semibold" : "font-medium")}>{title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatShortTime(conversation.last_message_at)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-muted-foreground">{conversation.last_message_preview ?? "—"}</p>
                    {conversation.unread_count > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Chat */}
      {selected ? (
        <>
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b px-3 py-2 md:hidden">
              <Link href={hrefWith({ c: null })} className="rounded-md p-1.5 hover:bg-muted" aria-label="Voltar">
                <ArrowLeft className="size-4" />
              </Link>
            </div>
            <ChatPanel
              key={selected.conversation.id}
              conversation={selected.conversation}
              messages={selected.messages}
              lastInboundAt={selected.contact.last_inbound_at}
              aiAutoReply={aiAutoReply}
            />
          </section>
          <aside className="hidden w-72 shrink-0 overflow-y-auto border-l xl:block">
            <ContactPanel conversation={selected.conversation} contact={selected.contact} tags={tags} tagIds={selected.tagIds} />
          </aside>
        </>
      ) : (
        <section className="hidden flex-1 items-center justify-center text-sm text-muted-foreground md:flex">
          Selecione uma conversa
        </section>
      )}
    </div>
  );
}
