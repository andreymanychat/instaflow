import type { Metadata } from "next";
import Link from "next/link";
import { Filter, Lock } from "lucide-react";
import { getOrgContext } from "@/server/auth/session";
import { getPlanLimits } from "@/server/services/plan-service";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SegmentDialog, type SegmentFilters } from "@/components/segments/segment-dialog";
import { DeleteSegmentButton } from "@/components/segments/delete-segment-button";
import type { Json } from "@/types/database";

export const metadata: Metadata = { title: "Segmentos" };

export default async function SegmentsPage() {
  const { supabase, organization } = await getOrgContext();
  const { advanced_segmentation: unlocked } = await getPlanLimits(organization.id);
  if (!unlocked) {
    return (
      <>
        <PageHeader title="Segmentos" description="Grupos dinâmicos de contatos baseados em tags e comportamento" />
        <PageBody>
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <Lock className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Segmentação avançada</p>
              <p className="px-6 text-sm text-muted-foreground">
                Crie públicos dinâmicos (ex.: tem a tag “interessado” E interagiu nos últimos 7 dias). Disponível nos planos Pro e Business.
              </p>
            </div>
            <Button asChild>
              <Link href="/billing">Ver planos</Link>
            </Button>
          </div>
        </PageBody>
      </>
    );
  }
  const [{ data: segments }, { data: tags }, { data: accounts }] = await Promise.all([
    supabase.from("segments").select("*").eq("organization_id", organization.id).order("created_at"),
    supabase.from("tags").select("id, name, color").eq("organization_id", organization.id).order("name"),
    supabase.from("instagram_accounts_public").select("id, username").eq("organization_id", organization.id),
  ]);

  const counts = await Promise.all(
    (segments ?? []).map(async (segment) => {
      const { count } = await supabase.rpc(
        "contacts_in_segment",
        { org: organization.id, filters: segment.filters as Json },
        { count: "exact", head: true },
      );
      return count ?? 0;
    }),
  );

  const lookups = { tags: tags ?? [], accounts: accounts ?? [] };

  return (
    <>
      <PageHeader
        title="Segmentos"
        description="Grupos dinâmicos de contatos baseados em tags e comportamento"
        actions={<SegmentDialog lookups={lookups} />}
      />
      <PageBody>
        {!segments?.length ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <Filter className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhum segmento</p>
              <p className="text-sm text-muted-foreground">Ex.: “Leads quentes” = tem a tag “interessado” E interagiu nos últimos 7 dias.</p>
            </div>
            <SegmentDialog lookups={lookups} />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {segments.map((segment, i) => (
              <Card key={segment.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{segment.name}</span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary tabular-nums">
                      {counts[i].toLocaleString("pt-BR")}
                    </span>
                  </CardTitle>
                  {segment.description && <CardDescription>{segment.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/contacts?segment=${segment.id}`}>Ver contatos</Link>
                  </Button>
                  <SegmentDialog
                    lookups={lookups}
                    segment={{
                      id: segment.id,
                      name: segment.name,
                      description: segment.description ?? "",
                      filters: segment.filters as unknown as SegmentFilters,
                    }}
                  />
                  <DeleteSegmentButton id={segment.id} name={segment.name} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
