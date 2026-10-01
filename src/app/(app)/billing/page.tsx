import type { Metadata } from "next";
import { Check } from "lucide-react";
import { getOrgContext } from "@/server/auth/session";
import { getBillingProvider } from "@/server/billing/billing-provider";
import { getPlanLimits, checkLimit, type LimitKey } from "@/server/services/plan-service";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Assinatura" };

const USAGE_LABELS: Record<LimitKey, string> = {
  instagram_accounts: "Contas do Instagram",
  contacts: "Contatos",
  active_automations: "Automações ativas",
  ai_replies_per_month: "Respostas de IA (mês)",
  members: "Membros",
};

export default async function BillingPage() {
  const { supabase, organization } = await getOrgContext();
  const { data: plans } = await supabase.from("plans").select("*").eq("is_active", true).order("sort_order");
  const limits = await getPlanLimits(organization.id);
  const usage = await Promise.all((Object.keys(USAGE_LABELS) as LimitKey[]).map(async (key) => ({ key, ...(await checkLimit(organization.id, key)) })));
  const billing = getBillingProvider();

  return (
    <>
      <PageHeader title="Assinatura" description="Plano atual, limites e upgrade" />
      <PageBody className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Uso do plano {plans?.find((p) => p.id === organization.plan_id)?.name ?? organization.plan_id}</CardTitle>
            <CardDescription>
              Status: {organization.subscription_status}
              {organization.current_period_end && ` · renova em ${formatDate(organization.current_period_end)}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {usage.map((item) => {
              const limit = limits[item.key];
              const pct = limit > 0 ? Math.min(100, (item.usage / limit) * 100) : 0;
              return (
                <div key={item.key}>
                  <p className="text-xs text-muted-foreground">{USAGE_LABELS[item.key]}</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {item.usage.toLocaleString("pt-BR")}
                    <span className="text-sm font-normal text-muted-foreground"> / {limit < 0 ? "∞" : limit.toLocaleString("pt-BR")}</span>
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full", pct >= 90 ? "bg-destructive" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {plans?.map((plan) => {
            const current = plan.id === organization.plan_id;
            return (
              <Card key={plan.id} className={cn("flex flex-col", current && "border-primary ring-1 ring-primary")}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {plan.name}
                    {current && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">Atual</span>}
                  </CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <p className="pt-2 text-3xl font-semibold">
                    {plan.price_cents === 0 ? "Grátis" : formatCurrency(plan.price_cents, plan.currency)}
                    {plan.price_cents > 0 && <span className="text-sm font-normal text-muted-foreground">/mês</span>}
                  </p>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" /> {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" variant={current ? "outline" : "default"} disabled={current || !billing.enabled}>
                    {current ? "Plano atual" : billing.enabled ? "Assinar" : "Em breve"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
        {!billing.enabled && (
          <p className="text-center text-sm text-muted-foreground">
            Pagamentos online ainda não estão ativos. A estrutura para Stripe já está pronta (veja <code>src/server/billing</code>).
          </p>
        )}
      </PageBody>
    </>
  );
}
