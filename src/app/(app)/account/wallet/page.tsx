import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isBillingConfigured } from "@/lib/env";
import { missingProfileFields } from "@/lib/profile";
import { loadBillingProfile } from "@/server/billing/billing-service";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TopUpDialog } from "@/components/billing/top-up-dialog";
import { SavedCards } from "@/components/billing/saved-cards";
import { PendingPixCard } from "@/components/billing/pending-pix-card";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Carteira e cartões" };

const KIND_LABELS = {
  referral_bonus: "Indicação",
  pix_topup: "Recarga Pix",
  subscription_debit: "Assinatura",
  adjustment: "Ajuste",
} as const;

export default async function WalletPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: wallet }, { data: transactions }, { data: cards }, { data: pendingTopUp }, profile] = await Promise.all([
    supabase.from("user_wallets").select("balance_cents").maybeSingle(),
    supabase.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("payment_methods").select("id, brand, last4, is_default").order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, amount_cents, pix_payload, pix_qr_image")
      .eq("kind", "topup")
      .eq("status", "pending")
      .not("pix_payload", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadBillingProfile(user.id),
  ]);

  const balance = wallet?.balance_cents ?? 0;
  const billingOn = isBillingConfigured();
  const profileComplete = missingProfileFields(profile).length === 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardDescription>Saldo disponível</CardDescription>
          <CardTitle className="text-4xl tabular-nums">{formatCurrency(balance)}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Créditos de indicações e recargas via Pix. Na renovação da assinatura usamos o saldo primeiro e cobramos só a diferença no cartão
          ou por Pix.
        </CardContent>
        <CardFooter className="flex flex-wrap items-center gap-3">
          <TopUpDialog disabled={!billingOn || !profileComplete} />
          {!profileComplete && (
            <Link href="/account" className="text-sm text-primary hover:underline">
              Complete seu cadastro para adicionar saldo
            </Link>
          )}
        </CardFooter>
      </Card>

      {pendingTopUp && (
        <PendingPixCard
          paymentId={pendingTopUp.id}
          payload={pendingTopUp.pix_payload!}
          image={pendingTopUp.pix_qr_image!}
          title="Recarga aguardando pagamento"
          description={`Pix de ${formatCurrency(pendingTopUp.amount_cents)}. O saldo entra assim que o pagamento for confirmado.`}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Cartões de crédito</CardTitle>
          <CardDescription>O cartão padrão é usado nas renovações automáticas. Guardamos apenas bandeira e final.</CardDescription>
        </CardHeader>
        <CardContent>
          <SavedCards cards={cards ?? []} canAdd={billingOn && profileComplete} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extrato</CardTitle>
        </CardHeader>
        <CardContent>
          {!transactions?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.created_at)}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{KIND_LABELS[t.kind]} · </span>
                      {t.description}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", t.amount_cents > 0 ? "text-emerald-600" : "text-destructive")}>
                      {t.amount_cents > 0 ? "+" : "−"} {formatCurrency(Math.abs(t.amount_cents))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(t.balance_after_cents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
