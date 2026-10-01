import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, Users } from "lucide-react";
import { getOrgContext } from "@/server/auth/session";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ContactAvatar } from "@/components/shared/contact-avatar";
import { ContactTagEditor } from "@/components/contacts/contact-tag-editor";
import { ContactFilters } from "@/components/contacts/contact-filters";
import { TagManager } from "@/components/contacts/tag-manager";
import { formatRelative } from "@/lib/utils";
import type { Json } from "@/types/database";

export const metadata: Metadata = { title: "Contatos" };

const PAGE_SIZE = 50;

export default async function ContactsPage({ searchParams }: PageProps<"/contacts">) {
  const { supabase, organization } = await getOrgContext();
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.replace(/[%,()]/g, "").trim() : "";
  const tagId = typeof params.tag === "string" ? params.tag : null;
  const segmentId = typeof params.segment === "string" ? params.segment : null;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const [{ data: tags }, { data: segments }] = await Promise.all([
    supabase.from("tags").select("id, name, color").eq("organization_id", organization.id).order("name"),
    supabase.from("segments").select("id, name, filters").eq("organization_id", organization.id).order("name"),
  ]);

  const segment = segments?.find((s) => s.id === segmentId);
  const columns = "id, username, name, profile_pic_url, is_follower, last_interaction_at, created_at, contact_tags(tag_id)";

  // Segmento Ã© avaliado no banco (funÃ§Ã£o contacts_in_segment); os demais filtros sÃ£o compostos por cima.
  let query = segment
    ? supabase.rpc("contacts_in_segment", { org: organization.id, filters: segment.filters as Json }, { count: "exact" }).select(columns)
    : supabase.from("contacts").select(columns, { count: "exact" }).eq("organization_id", organization.id);

  if (search) query = query.or(`username.ilike.%${search}%,name.ilike.%${search}%`);
  if (tagId) {
    const { data: tagged } = await supabase.from("contact_tags").select("contact_id").eq("tag_id", tagId).limit(5000);
    query = query.in("id", (tagged ?? []).map((t) => t.contact_id).concat("00000000-0000-0000-0000-000000000000"));
  }

  const { data: contacts, count } = await query.order("last_interaction_at", { ascending: false }).range(from, from + PAGE_SIZE - 1);
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  const { data: conversations } = contacts?.length
    ? await supabase.from("conversations").select("id, contact_id").in("contact_id", contacts.map((c) => c.id))
    : { data: [] };
  const conversationByContact = new Map((conversations ?? []).map((c) => [c.contact_id, c.id]));

  const pageHref = (p: number) => {
    const next = new URLSearchParams(Object.entries(params).filter(([, v]) => typeof v === "string") as [string, string][]);
    next.set("page", String(p));
    return `/contacts?${next}`;
  };

  return (
    <>
      <PageHeader
        title="Contatos e tags"
        description={`${(count ?? 0).toLocaleString("pt-BR")} contato(s)`}
        actions={<TagManager tags={tags ?? []} />}
      />
      <PageBody className="space-y-4">
        <ContactFilters tags={tags ?? []} segments={(segments ?? []).map((s) => ({ id: s.id, name: s.name }))} />

        {!contacts?.length ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <Users className="size-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhum contato encontrado. Contatos sÃ£o criados automaticamente quando alguÃ©m comenta ou envia DM.
            </p>
          </div>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contato</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="hidden md:table-cell">Segue</TableHead>
                    <TableHead className="hidden md:table-cell">Ãšltima interaÃ§Ã£o</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ContactAvatar contact={contact} className="size-8" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{contact.name ?? "â€”"}</p>
                            <p className="truncate text-xs text-muted-foreground">{contact.username ? `@${contact.username}` : ""}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-48">
                        <ContactTagEditor contactId={contact.id} tags={tags ?? []} assigned={contact.contact_tags.map((t) => t.tag_id)} />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {contact.is_follower === null ? "â€”" : contact.is_follower ? "Sim" : "NÃ£o"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">{formatRelative(contact.last_interaction_at)}</TableCell>
                      <TableCell>
                        {conversationByContact.has(contact.id) && (
                          <Button asChild variant="ghost" size="icon" aria-label="Abrir conversa">
                            <Link href={`/inbox?status=all&c=${conversationByContact.get(contact.id)}`}>
                              <MessageCircle className="size-4" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">PÃ¡gina {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" disabled={page <= 1}>
                <Link href={pageHref(Math.max(1, page - 1))}>Anterior</Link>
              </Button>
              <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
                <Link href={pageHref(Math.min(totalPages, page + 1))}>PrÃ³xima</Link>
              </Button>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}
