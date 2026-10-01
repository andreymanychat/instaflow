"use client";

import { ContactAvatar } from "@/components/shared/contact-avatar";
import { ContactTagEditor } from "@/components/contacts/contact-tag-editor";
import { formatDate, formatRelative } from "@/lib/utils";
import type { InboxConversation } from "./inbox-view";

type Props = {
  conversation: InboxConversation;
  contact: { id: string; igsid: string; is_follower: boolean | null; follower_count: number | null; created_at: string; last_inbound_at: string | null };
  tags: { id: string; name: string; color: string }[];
  tagIds: string[];
};

export function ContactPanel({ conversation, contact, tags, tagIds }: Props) {
  const c = conversation.contact;
  const rows = [
    { label: "Segue o perfil", value: contact.is_follower === null ? "Desconhecido" : contact.is_follower ? "Sim" : "Não" },
    { label: "Seguidores", value: contact.follower_count?.toLocaleString("pt-BR") ?? "—" },
    { label: "Primeiro contato", value: formatDate(contact.created_at) },
    { label: "Última mensagem", value: contact.last_inbound_at ? formatRelative(contact.last_inbound_at) : "—" },
    { label: "IGSID", value: contact.igsid },
  ];

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <ContactAvatar contact={c} className="size-16" />
        <div>
          <p className="font-semibold">{c.name ?? "Sem nome"}</p>
          {c.username && (
            <a href={`https://instagram.com/${c.username}`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
              @{c.username}
            </a>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Tags</p>
        <ContactTagEditor contactId={contact.id} tags={tags} assigned={tagIds} />
      </div>

      <dl className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="truncate text-right font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
