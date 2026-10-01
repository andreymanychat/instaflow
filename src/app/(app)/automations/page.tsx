import type { Metadata } from "next";
import Link from "next/link";
import { Workflow } from "lucide-react";
import { getOrgContext } from "@/server/auth/session";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { NewAutomationDialog } from "@/components/automations/new-automation-dialog";
import { AutomationRowActions } from "@/components/automations/automation-row-actions";
import { AutomationStatusBadge } from "@/components/automations/automation-status-badge";
import { TRIGGER_LABELS, type AutomationTemplateId } from "@/lib/automation-templates";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Automações" };

export default async function AutomationsPage({ searchParams }: PageProps<"/automations">) {
  const { supabase, organization } = await getOrgContext();
  const { new: openTemplate } = await searchParams;

  const { data: automations } = await supabase
    .from("automations")
    .select("id, name, status, trigger_type, trigger_config, runs_count, last_run_at, updated_at, instagram_account_id")
    .eq("organization_id", organization.id)
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Automações"
        description="Fluxos que respondem comentários e mensagens automaticamente"
        actions={<NewAutomationDialog defaultTemplate={typeof openTemplate === "string" ? (openTemplate as AutomationTemplateId) : undefined} />}
      />
      <PageBody>
        {!automations?.length ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <Workflow className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhuma automação ainda</p>
              <p className="text-sm text-muted-foreground">Comece por um modelo pronto — leva menos de 2 minutos.</p>
            </div>
            <NewAutomationDialog />
          </div>
        ) : (
          <Card className="divide-y overflow-hidden p-0">
            {automations.map((automation) => {
              const config = automation.trigger_config as { keywords?: string[]; match?: string };
              return (
                <div key={automation.id} className="flex flex-wrap items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
                  <Link href={`/automations/${automation.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{automation.name}</p>
                      <AutomationStatusBadge status={automation.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {TRIGGER_LABELS[automation.trigger_type]}
                      {config.match === "any" ? " · qualquer texto" : config.keywords?.length ? ` · ${config.keywords.join(", ")}` : ""}
                    </p>
                  </Link>
                  <div className="hidden text-right text-sm sm:block">
                    <p className="font-medium tabular-nums">{automation.runs_count.toLocaleString("pt-BR")} execuções</p>
                    <p className="text-xs text-muted-foreground">
                      {automation.last_run_at ? `Última ${formatRelative(automation.last_run_at)}` : "Nunca executada"}
                    </p>
                  </div>
                  <AutomationRowActions id={automation.id} status={automation.status} />
                </div>
              );
            })}
          </Card>
        )}
      </PageBody>
    </>
  );
}
