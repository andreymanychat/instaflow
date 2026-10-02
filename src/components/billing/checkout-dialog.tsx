"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardFields, EMPTY_CARD } from "@/components/billing/card-fields";
import { PixPayment } from "@/components/billing/pix-payment";
import { cn, formatCurrency } from "@/lib/utils";
import { checkoutPlan, type CheckoutPaymentInput } from "@/server/actions/billing-actions";

export type SavedCard = { id: string; brand: string | null; last4: string | null; is_default: boolean };

type Props = {
  plan: { id: string; name: string; priceCents: number };
  walletCents: number;
  chargeCents: number;
  cards: SavedCard[];
  missingProfile: string[];
  label: string;
  variant?: "default" | "outline";
};

type Step = { kind: "form" } | { kind: "pix"; paymentId: string; payload: string; image: string } | { kind: "done" };

export function CheckoutDialog({ plan, walletCents, chargeCents, cards, missingProfile, label, variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [method, setMethod] = useState<"card" | "pix">("card");
  const defaultCard = cards.find((c) => c.is_default) ?? cards[0];
  const [cardId, setCardId] = useState<string | "new">(defaultCard?.id ?? "new");
  const [card, setCard] = useState(EMPTY_CARD);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const reset = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setStep({ kind: "form" });
      setCard(EMPTY_CARD);
      router.refresh();
    }
  };

  const pay = () =>
    startTransition(async () => {
      const payment: CheckoutPaymentInput =
        chargeCents === 0 || method === "pix"
          ? { method: "pix" }
          : cardId === "new"
            ? { method: "new_card", card }
            : { method: "card", cardId };
      const result = await checkoutPlan({ planId: plan.id, payment });
      if (!result.ok) return void toast.error(result.error);
      const data = result.data;
      if (data.status === "failed") return void toast.error(data.error);
      if (data.status === "paid") {
        setStep({ kind: "done" });
        return;
      }
      if (data.pix) setStep({ kind: "pix", paymentId: data.paymentId, payload: data.pix.payload, image: data.pix.image });
      else {
        toast.info("Pagamento em análise. Você será avisado quando for aprovado.");
        reset(false);
      }
    });

  const blocked = missingProfile.length > 0;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button className="w-full" variant={variant}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assinar o plano {plan.name}</DialogTitle>
          <DialogDescription>Cobrança mensal, renovação automática. Cancele quando quiser.</DialogDescription>
        </DialogHeader>

        {step.kind === "done" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-12 text-emerald-500" />
            <p className="font-medium">Pagamento confirmado! O plano {plan.name} já está ativo.</p>
            <Button onClick={() => reset(false)}>Continuar</Button>
          </div>
        ) : step.kind === "pix" ? (
          <PixPayment
            paymentId={step.paymentId}
            payload={step.payload}
            image={step.image}
            onPaid={() => setStep({ kind: "done" })}
            onFailed={(reason) => {
              toast.error(reason);
              setStep({ kind: "form" });
            }}
          />
        ) : blocked ? (
          <div className="space-y-3 text-sm">
            <p>Para emitir a cobrança precisamos do seu cadastro completo. Faltando: {missingProfile.join(", ")}.</p>
            <Button asChild className="w-full">
              <Link href="/account">Completar cadastro</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1 rounded-lg border p-3 text-sm">
              <Row label={`Plano ${plan.name} (mensal)`} value={formatCurrency(plan.priceCents)} />
              {walletCents > 0 && <Row label="Saldo da carteira" value={`− ${formatCurrency(walletCents)}`} className="text-emerald-600" />}
              <Row label="Total a pagar agora" value={formatCurrency(chargeCents)} className="border-t pt-1 font-semibold" />
            </div>

            {chargeCents === 0 ? (
              <p className="text-sm text-muted-foreground">Seu saldo cobre o valor total. Nada será cobrado no cartão ou Pix.</p>
            ) : (
              <Tabs value={method} onValueChange={(v) => setMethod(v as "card" | "pix")}>
                <TabsList className="w-full">
                  <TabsTrigger value="card">
                    <CreditCard className="size-4" /> Cartão
                  </TabsTrigger>
                  <TabsTrigger value="pix">
                    <QrCode className="size-4" /> Pix
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="card" className="space-y-3 pt-2">
                  {cards.length > 0 && (
                    <div className="space-y-1.5">
                      <Label>Cartão</Label>
                      <div className="grid gap-2">
                        {cards.map((c) => (
                          <CardOption key={c.id} selected={cardId === c.id} onClick={() => setCardId(c.id)}>
                            {c.brand ?? "Cartão"} •••• {c.last4}
                          </CardOption>
                        ))}
                        <CardOption selected={cardId === "new"} onClick={() => setCardId("new")}>
                          Usar outro cartão
                        </CardOption>
                      </div>
                    </div>
                  )}
                  {cardId === "new" && <CardFields value={card} onChange={setCard} />}
                  <p className="text-xs text-muted-foreground">
                    O cartão fica salvo de forma segura no Asaas para as próximas renovações. Não armazenamos o número completo.
                  </p>
                </TabsContent>
                <TabsContent value="pix" className="pt-2 text-sm text-muted-foreground">
                  Geramos um QR Code Pix. Nas renovações, um novo Pix é enviado 3 dias antes do vencimento (ou use saldo/cartão para
                  renovar automaticamente).
                </TabsContent>
              </Tabs>
            )}

            <DialogFooter>
              <Button className="w-full" disabled={pending} onClick={pay}>
                {pending ? "Processando..." : chargeCents === 0 ? "Confirmar com saldo" : method === "pix" ? "Gerar Pix" : `Pagar ${formatCurrency(chargeCents)}`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex justify-between gap-4", className)}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function CardOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted", selected && "border-primary ring-1 ring-primary")}
    >
      {children}
    </button>
  );
}
