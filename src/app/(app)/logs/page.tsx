import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { getOrgContext } from "@/server/auth/session";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogLevelBadge } from "@/components/logs/log-level-badge";
import { LogFilters } from "@/components/logs/log-filters";
import { formatDateTime } from "@/lib/utils";
import type { Enums } from "@/types/database";

export const metadata: Metadata = { title: "Logs" };

const PAGE_SIZE = 100;
const LEVELS: Enums<"log_level">[] = ["debug", "info", "warn", "error"];

export default async function LogsPage({ searchParams }: PageProps<"/logs">) {
  const { supabase, organization } = await getOrgContext();
  const params = await searchParams;
  const level = LEVELS.find((l) => l === params.level);
  const source = typeof params.source === "string" ? params.source : null;
  const tab = params.tab === "runs" ? "runs" : params.tab === "webhooks" ? "webhooks" : "logs";

  return (
    <>
      <PageHeader title="Logs" description="Tudo o que aconteceu nos bastidores: webhooks, automações, IA e erros" />
      <PageBody className="space-y-4">
        <div className="flex gap-2">
          {[
            { id: "logs", label: "Eventos" },
            { id: "runs", label: "Execuções de automações" },
            { id: "webhooks", label: "Webhooks brutos" },
          ].map((t) => (
            <Button key={t.id} asChild size="sm" variant={tab === t.id ? "default" : "outline"}>
              <Link href={`/logs?tab=${t.id}`}>{t.label}</Link>
            </Button>
          ))}
        </div>

        {tab === "logs" && <EventLogs organizationId={organization.id} level={level} source={source} supabase={supabase} />}
        {tab === "runs" && <RunLogs organizationId={organization.id} supabase={supabase} />}
        {tab === "webhooks" && <WebhookLogs organizationId={organization.id} supabase={supabase} />}
      </PageBody>
    </>
  );
}

type Supabase = Awaited<ReturnType<typeof getOrgContext>>["supabase"];

async function EventLogs({ organizationId, level, source, supabase }: { organizationId: string; level?: Enums<"log_level">; source: string | null; supabase: Supabase }) {
  let query = supabase
    .from("logs")
    .select("id, level, source, event, message, metadata, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (level) query = query.eq("level", level);
  if (source) query = query.eq("source", source);
  const { data: logs } = await query;

  return (
    <>
      <LogFilters />
      {!logs?.length ? (
        <Empty />
      ) : (
        <Card className="divide-y p-0 font-mono text-xs">
          {logs.map((log) => (
            <details key={log.id} className="group px-4 py-2.5">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
                <span className="w-36 shrink-0 text-muted-foreground">{formatDateTime(log.created_at)}</span>
                <LogLevelBadge level={log.level} />
                <span className="rounded bg-muted px-1.5 py-0.5">{log.source}.{log.event}</span>
                <span className="min-w-0 flex-1 font-sans text-sm">{log.message}</span>
              </summary>
              {log.metadata && Object.keys(log.metadata as object).length > 0 && (
                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2">{JSON.stringify(log.metadata, null, 2)}</pre>
              )}
            </details>
          ))}
        </Card>
      )}
    </>
  );
}

const RUN_STATUS: Record<string, string> = {
  running: "Executando",
  waiting_delay: "Aguardando delay",
  waiting_input: "Aguardando clique",
  completed: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
};

async function RunLogs({ organizationId, supabase }: { organizationId: string; supabase: Supabase }) {
  const { data: runs } = await supabase
    .from("automation_runs")
    .select("id, status, error, started_at, steps_executed, automation:automations(name), contact:contacts(username, name)")
    .eq("organization_id", organizationId)
    .order("started_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (!runs?.length) return <Empty />;
  return (
    <Card className="divide-y p-0 text-sm">
      {runs.map((run) => (
        <div key={run.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">{formatDateTime(run.started_at)}</span>
          <span className="font-medium">{run.automation?.name ?? "—"}</span>
          <span className="text-muted-foreground">→ @{run.contact?.username ?? run.contact?.name ?? "?"}</span>
          <span
            className={
              run.status === "failed"
                ? "rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
                : "rounded bg-muted px-2 py-0.5 text-xs"
            }
          >
            {RUN_STATUS[run.status]}
          </span>
          <span className="text-xs text-muted-foreground">{run.steps_executed} passo(s)</span>
          {run.error && <span className="w-full text-xs text-destructive">{run.error}</span>}
        </div>
      ))}
    </Card>
  );
}

async function WebhookLogs({ organizationId, supabase }: { organizationId: string; supabase: Supabase }) {
  const { data: events } = await supabase
    .from("webhook_events")
    .select("id, created_at, processed_at, error, payload")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!events?.length) return <Empty />;
  return (
    <Card className="divide-y p-0 font-mono text-xs">
      {events.map((event) => (
        <details key={event.id} className="px-4 py-2.5">
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2">
            <span className="w-36 shrink-0 text-muted-foreground">{formatDateTime(event.created_at)}</span>
            <span className={event.error ? "text-destructive" : event.processed_at ? "text-emerald-600" : "text-amber-600"}>
              {event.error ? `erro: ${event.error}` : event.processed_at ? "processado" : "pendente"}
            </span>
          </summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded bg-muted p-2">{JSON.stringify(event.payload, null, 2)}</pre>
        </details>
      ))}
    </Card>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
      <ScrollText className="size-10" />
      Nenhum registro encontrado.
    </div>
  );
}
