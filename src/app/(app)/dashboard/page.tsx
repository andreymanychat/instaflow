import type { Metadata } from "next";
import Link from "next/link";
import { Bot, CheckCircle2, Circle, Inbox, MessageCircle, MessagesSquare, Users, Workflow } from "lucide-react";
import { getOrgContext } from "@/server/auth/session";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/dashboard/stat-card";
import { ActivityChart } from "@/components/dashboard/activity-chart";
import { LogLevelBadge } from "@/components/logs/log-level-badge";
import { formatRelative } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

type Stats = {
  contacts: number;
  new_contacts_7d: number;
  messages_in_7d: number;
  messages_out_7d: number;
  ai_replies_30d: number;
  active_automations: number;
  runs_7d: number;
  comments_7d: number;
  open_conversations: number;
  daily: { day: string; inbound: number; outbound: number }[];
};

export default async function DashboardPage() {
  const { supabase, organization } = await getOrgContext();

  const [{ data: statsJson }, { count: accounts }, { count: automations }, { data: logs }] = await Promise.all([
    supabase.rpc("dashboard_stats", { org: organization.id }),
    supabase.from("instagram_accounts_public").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
    supabase.from("automations").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
    supabase
      .from("logs")
      .select("id, level, message, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);
  const stats = (statsJson ?? {}) as Partial<Stats>;

  const checklist = [
    { done: (accounts ?? 0) > 0, label: "Conectar uma conta do Instagram", href: "/settings/instagram" },
    { done: (automations ?? 0) > 0, label: "Criar a primeira automação", href: "/automations" },
    { done: (stats.active_automations ?? 0) > 0, label: "Ativar uma automação", href: "/automations" },
    { done: Boolean(organization.default_ai_prompt_id), label: "Configurar o prompt da IA", href: "/ai" },
  ];
  const pending = checklist.filter((c) => !c.done).length;

  return (
    <>
      <PageHeader title="Dashboard" description={`Visão geral de ${organization.name}`} />
      <PageBody className="space-y-6">
        {pending > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Primeiros passos</CardTitle>
              <CardDescription>{pending} de {checklist.length} tarefas pendentes para deixar tudo no ar.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {checklist.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors hover:bg-muted"
                >
                  {item.done ? <CheckCircle2 className="size-5 text-emerald-500" /> : <Circle className="size-5 text-muted-foreground" />}
                  <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.label}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} label="Contatos" value={stats.contacts ?? 0} hint={`+${stats.new_contacts_7d ?? 0} nos últimos 7 dias`} />
          <StatCard icon={MessagesSquare} label="Mensagens (7d)" value={(stats.messages_in_7d ?? 0) + (stats.messages_out_7d ?? 0)} hint={`${stats.messages_in_7d ?? 0} recebidas · ${stats.messages_out_7d ?? 0} enviadas`} />
          <StatCard icon={Workflow} label="Execuções de automação (7d)" value={stats.runs_7d ?? 0} hint={`${stats.active_automations ?? 0} automações ativas`} />
          <StatCard icon={Bot} label="Respostas de IA (30d)" value={stats.ai_replies_30d ?? 0} hint={`${stats.comments_7d ?? 0} comentários em 7 dias`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Atividade de mensagens</CardTitle>
              <CardDescription>Últimos 14 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityChart data={stats.daily ?? []} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Atividade recente</CardTitle>
                <CardDescription>{stats.open_conversations ?? 0} conversas abertas</CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/logs">Ver logs</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {(logs ?? []).length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted-foreground">
                  <Inbox className="size-6" /> Nenhuma atividade ainda.
                </div>
              )}
              {(logs ?? []).map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-sm">
                  <LogLevelBadge level={log.level} compact />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2">{log.message}</p>
                    <p className="text-xs text-muted-foreground">{formatRelative(log.created_at)}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <MessageCircle className="size-8 text-primary" />
              <div>
                <p className="font-medium">Dica: comece com “Comentário → Direct”</p>
                <p className="text-sm text-muted-foreground">É o fluxo que mais gera leads no Instagram.</p>
              </div>
            </div>
            <Button asChild>
              <Link href="/automations?new=comment_to_dm">Criar agora</Link>
            </Button>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
