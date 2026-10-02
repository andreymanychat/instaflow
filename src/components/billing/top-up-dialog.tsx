"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PixPayment } from "@/components/billing/pix-payment";
import { cn } from "@/lib/utils";
import { topUpWallet } from "@/server/actions/billing-actions";

const PRESETS = [20, 50, 100];

type Step = { kind: "form" } | { kind: "pix"; paymentId: string; payload: string; image: string } | { kind: "done" };

export function TopUpDialog({ suggested, disabled }: { suggested?: number; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(suggested ?? 50));
  const [step, setStep] = useState<Step>({ kind: "form" });
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const change = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setStep({ kind: "form" });
      router.refresh();
    }
  };

  const submit = () =>
    startTransition(async () => {
      const result = await topUpWallet(Number(amount.replace(",", ".")));
      if (!result.ok) return void toast.error(result.error);
      const data = result.data;
      if (data.status === "failed") return void toast.error(data.error);
      if (data.status === "pending" && data.pix) {
        setStep({ kind: "pix", paymentId: data.paymentId, payload: data.pix.payload, image: data.pix.image });
      }
    });

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Plus className="size-4" /> Adicionar saldo via Pix
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar saldo</DialogTitle>
          <DialogDescription>O saldo é usado automaticamente nas próximas cobranças da sua assinatura.</DialogDescription>
        </DialogHeader>
        {step.kind === "done" ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 className="size-12 text-emerald-500" />
            <p className="font-medium">Saldo adicionado!</p>
            <Button onClick={() => change(false)}>Fechar</Button>
          </div>
        ) : step.kind === "pix" ? (
          <PixPayment
            paymentId={step.paymentId}
            payload={step.payload}
            image={step.image}
            onPaid={() => {
              toast.success("Saldo adicionado à sua carteira!");
              setStep({ kind: "done" });
            }}
            onFailed={(reason) => {
              toast.error(reason);
              setStep({ kind: "form" });
            }}
          />
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              {PRESETS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAmount(String(value))}
                  className={cn(
                    "flex-1 rounded-md border py-2 text-sm transition-colors hover:bg-muted",
                    amount === String(value) && "border-primary ring-1 ring-primary",
                  )}
                >
                  R$ {value}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topup-amount">Outro valor (R$)</Label>
              <Input id="topup-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))} />
              <p className="text-xs text-muted-foreground">Mínimo R$ 10,00.</p>
            </div>
            <DialogFooter>
              <Button className="w-full" disabled={pending} onClick={submit}>
                {pending ? "Gerando Pix..." : "Gerar Pix"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
