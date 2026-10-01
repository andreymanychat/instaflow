import type { Metadata } from "next";
import { getOrgContext } from "@/server/auth/session";
import { InboxView, type InboxConversation, type InboxMessage } from "@/components/inbox/inbox-view";

export const metadata: Metadata = { title: "Caixa de entrada" };

const PAGE_SIZE = 50;

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const { supabase, organization } = await getOrgContext();
  const params = await searchParams;
  const status = params.status === "closed" ? "closed" : params.status === "all" ? "all" : "open";
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const selectedId = typeof params.c === "string" ? params.c : null;

  let query = supabase
    .from("conversations")
    .select(
      "id, status, last_message_at, last_message_preview, unread_count, ai_enabled, bot_paused_until, contact:contacts!inner(id, username, name, profile_pic_url), account:instagram_accounts(username)",
    )
    .eq("organization_id", organization.id)
    .order("last_message_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (status !== "all") query = query.eq("status", status);
  if (search) {
    const term = search.replace(/[%,()]/g, "");
    query = query.or(`username.ilike.%${term}%,name.ilike.%${term}%`, { referencedTable: "contacts" });
  }

  const [{ data: conversations }, { data: tags }] = await Promise.all([
    query,
    supabase.from("tags").select("id, name, color").eq("organization_id", organization.id).order("name"),
  ]);

  let selected: {
    conversation: InboxConversation;
    messages: InboxMessage[];
    contact: { id: string; igsid: string; is_follower: boolean | null; follower_count: number | null; created_at: string; last_inbound_at: string | null };
    tagIds: string[];
  } | null = null;

  if (selectedId) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select(
        "id, status, last_message_at, last_message_preview, unread_count, ai_enabled, bot_paused_until, contact:contacts!inner(id, username, name, profile_pic_url), account:instagram_accounts(username)",
      )
      .eq("id", selectedId)
      .eq("organization_id", organization.id)
      .maybeSingle();

    if (conversation) {
      const [{ data: messages }, { data: contact }, { data: contactTags }] = await Promise.all([
        supabase
          .from("messages")
          .select("id, direction, source, text, error, created_at, payload")
          .eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("contacts")
          .select("id, igsid, is_follower, follower_count, created_at, last_inbound_at")
          .eq("id", conversation.contact.id)
          .single(),
        supabase.from("contact_tags").select("tag_id").eq("contact_id", conversation.contact.id),
      ]);
      if (contact) {
        selected = {
          conversation: conversation as InboxConversation,
          messages: ((messages ?? []) as InboxMessage[]).reverse(),
          contact,
          tagIds: (contactTags ?? []).map((t) => t.tag_id),
        };
      }
    }
  }

  return (
    <InboxView
      organizationId={organization.id}
      conversations={(conversations ?? []) as InboxConversation[]}
      selected={selected}
      tags={tags ?? []}
      filters={{ status, search }}
      aiAutoReply={organization.ai_auto_reply_enabled}
    />
  );
}
