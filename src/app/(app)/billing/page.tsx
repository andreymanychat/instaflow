import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Check, Wallet } from "lucide-react";
import { canManage, getOrgContext } from "@/server/auth/session";
import { getPlanLimits, checkLimit, type LimitKey } from "@/server/services/plan-service";
import { getWalletBalance, loadBillingProfile } from "@/server/billing/billing-service";
import { splitWithWallet } from "@/server/billing/pricing";
import { isBillingConfigured } from "@/lib/env";
import { missingProfileFields } from "@/lib/profile";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckoutDialog } from "@/components/billing/checkout-dialog";
import { SubscriptionActions } from "@/components/billing/subscription-actions";
import { PendingPixCard } from "@/components/billing/pending-pix-card";
import { METHOD_LABELS, PaymentStatusBadge } from "@/components/billing/payment-status-badge";
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
  const { supabase, organization, user, role } = await getOrgContext();
  const [{ data: plans }, limits, usage, balance, profile, { data: cards }, { data: payments }] = await Promise.all([
    supabase.from("plans").select("*").eq("is_active", true).order("sort_order"),
    getPlanLimits(organization.id),
    Promise.all((Object.keys(USAGE_LABELS) as LimitKey[]).map(async (key) => ({ key, ...(await checkLimit(organization.id, key)) }))),
    getWalletBalance(user.id),
    loadBillingProfile(user.id),
    supabase.from("payment_methods").select("id, brand, last4, is_default").order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, kind, plan_id, is_renewal, amount_cents, wallet_used_cents, method, status, created_at, paid_at, due_date, pix_payload, pix_qr_image, failure_reason")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const billingOn = isBillingConfigured();
  const isAdmin = canManage(role);
  const missing = missingProfileFields(profile);
  const currentPlan = plans?.find((p) => p.id === organization.plan_id);
  const paid = organization.plan_id !== "free";
  const periodEnd = organization.current_period_end ? formatDate(organization.current_period_end) : null;
  const pendingPix = payments?.find((p) => p.status === "pending" && p.method === "pix" && p.pix_payload && p.pix_qr_image);

  return (
    <>
      <PageHeader title="Assinatura" description="Plano, limites, pagamentos e renovação" />
      <PageBody className="space-y-6">
        {organization.subscription_status === "canceled" && !paid && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/50 bg-amber-500/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p>A assinatura desta organização foi encerrada e ela voltou ao plano Free. Automações acima do limite foram pausadas.</p>
          </div>
        )}

        {pendingPix && (
          <PendingPixCard
            paymentId={pendingPix.id}
            payload={pendingPix.pix_payload!}
            image={pendingPix.pix_qr_image!}
            title={pendingPix.is_renewal ? "Pix da renovação disponível" : "Pix aguardando pagamento"}
            description={`${formatCurrency(pendingPix.amount_cents - pendingPix.wallet_used_cents)}${
              pendingPix.due_date ? ` · vence em ${formatDate(pendingPix.due_date)}` : ""
            }${pendingPix.is_renewal ? " · sem pagamento até o vencimento, a organização volta ao Free." : ""}`}
          />
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Plano {currentPlan?.name ?? organization.plan_id}
              {organization.cancel_at_period_end && (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-normal text-amber-700 dark:text-amber-400">
                  cancelamento agendado
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {paid && periodEnd
                ? organization.cancel_at_period_end
                  ? `Ativo até ${periodEnd}. Depois volta ao Free.`
                  : `Renova em ${periodEnd} · ${formatCurrency(currentPlan?.price_cents ?? 0)}/mês (saldo da carteira primeiro, depois cartão ou Pix).`
                : "Plano gratuito. Faça upgrade quando precisar de mais."}
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
          <CardFooter className="flex flex-wrap items-center justify-between gap-2">
            <Link href="/account/wallet" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <Wallet className="size-4" /> Saldo da carteira: <strong className="text-foreground">{formatCurrency(balance)}</strong>
            </Link>
            {paid && isAdmin && <SubscriptionActions cancelScheduled={organization.cancel_at_period_end} periodEnd={periodEnd} />}
          </CardFooter>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {plans?.map((plan) => {
            const current = plan.id === organization.plan_id;
            const split = splitWithWallet(plan.price_cents, balance);
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
                  {current ? (
                    <Button className="w-full" variant="outline" disabled>
                      Plano atual
                    </Button>
                  ) : plan.price_cents === 0 ? (
                    <p className="w-full text-center text-xs text-muted-foreground">
                      {paid ? "Para voltar ao Free, cancele a assinatura acima." : ""}
                    </p>
                  ) : !billingOn ? (
                    <Button className="w-full" disabled>
                      Em breve
                    </Button>
                  ) : !isAdmin ? (
                    <p className="w-full text-center text-xs text-muted-foreground">Apenas donos e administradores podem assinar.</p>
                  ) : (
                    <CheckoutDialog
                      plan={{ id: plan.id, name: plan.name, priceCents: plan.price_cents }}
                      walletCents={split.walletCents}
                      chargeCents={split.chargeCents}
                      cards={cards ?? []}
                      missingProfile={missing}
                      label={paid ? `Mudar para ${plan.name}` : `Assinar ${plan.name}`}
                      variant={plan.id === "pro" ? "default" : "outline"}
                    />
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {!billingOn && (
          <p className="text-center text-sm text-muted-foreground">Pagamentos online ainda não estão ativos neste ambiente.</p>
        )}
        {paid && billingOn && (
          <p className="text-center text-xs text-muted-foreground">
            Ao mudar de plano, o novo plano começa na hora com um novo período de 1 mês (sem cobrança proporcional).
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Histórico de pagamentos</CardTitle>
            <CardDescription>Pagamentos feitos por você nesta organização.</CardDescription>
          </CardHeader>
          <CardContent>
            {!payments?.length ? (
              <p className="text-sm text-muted-foreground">Nenhum pagamento ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Forma</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.paid_at ?? p.created_at)}</TableCell>
                      <TableCell>
                        {p.is_renewal ? "Renovação" : "Assinatura"} {plans?.find((pl) => pl.id === p.plan_id)?.name ?? p.plan_id}
                        {p.failure_reason && p.status === "failed" && <p className="text-xs text-muted-foreground">{p.failure_reason}</p>}
                      </TableCell>
                      <TableCell>
                        {METHOD_LABELS[p.method]}
                        {p.wallet_used_cents > 0 && p.method !== "wallet" && " + saldo"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.amount_cents)}</TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={p.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
