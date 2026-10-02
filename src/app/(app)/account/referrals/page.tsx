import type { Metadata } from "next";
import Link from "next/link";
import { Gift } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { REFERRAL_REWARD_CENTS } from "@/server/billing/pricing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyField } from "@/components/shared/copy-field";
import { ReferralLinkButton } from "@/components/account/referral-link-button";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Indique e ganhe" };

const STATUS = {
  pending: { label: "Aguardando assinatura", variant: "secondary" },
  rewarded: { label: "Crédito recebido", variant: "default" },
  ineligible: { label: "Sem crédito", variant: "outline" },
} as const;

export default async function ReferralsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const [{ count: paidOrgs }, { data: links }, { data: referrals }] = await Promise.all([
    createAdminClient()
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("billing_owner_id", user.id)
      .neq("plan_id", "free")
      .gt("current_period_end", now),
    supabase.from("referral_links").select("*").gt("expires_at", now).order("created_at", { ascending: false }).limit(5),
    supabase.from("referrals").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  // Nome dos indicados: só o primeiro nome (o perfil completo de terceiros não é exposto)
  const referredIds = (referrals ?? []).map((r) => r.referred_id);
  const { data: names } = referredIds.length
    ? await createAdminClient().from("profiles").select("id, full_name").in("id", referredIds)
    : { data: [] };
  const firstName = (id: string) => names?.find((n) => n.id === id)?.full_name?.split(" ")[0] ?? "Usuário";
  const earned = (referrals ?? []).reduce((sum, r) => sum + r.reward_cents, 0);
  const eligible = Boolean(paidOrgs);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="size-5 text-primary" /> Indique e ganhe {formatCurrency(REFERRAL_REWARD_CENTS)}
          </CardTitle>
          <CardDescription>
            Envie seu link para quem ainda não usa o ChatFlow. Quando a pessoa criar a conta pelo link e assinar um plano pago, você recebe{" "}
            {formatCurrency(REFERRAL_REWARD_CENTS)} de crédito na sua carteira, usado automaticamente na sua próxima renovação. Cada link vale
            por 3 dias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {eligible ? (
            <>
              <ReferralLinkButton appUrl={appUrl} />
              {links?.map((link) => (
                <div key={link.id} className="space-y-1">
                  <CopyField label={`Link válido até ${formatDateTime(link.expires_at)}`} value={`${appUrl}/r/${link.code}`} />
                </div>
              ))}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4 text-sm">
              <p className="flex-1">O Indique e ganhe é exclusivo para assinantes dos planos Pro e Business.</p>
              <Button asChild size="sm">
                <Link href="/billing">Ver planos</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Suas indicações</CardTitle>
          <CardDescription>Total recebido: {formatCurrency(earned)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!referrals?.length && <p className="text-sm text-muted-foreground">Ninguém se cadastrou pelo seu link ainda.</p>}
          {referrals?.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="flex-1">{firstName(r.referred_id)}</span>
              <span className="text-xs text-muted-foreground">cadastro em {formatDate(r.created_at)}</span>
              <Badge variant={STATUS[r.status].variant}>
                {STATUS[r.status].label}
                {r.status === "rewarded" && ` · ${formatCurrency(r.reward_cents)}`}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
