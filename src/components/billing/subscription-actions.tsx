"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { setCancelAtPeriodEnd } from "@/server/actions/billing-actions";

export function SubscriptionActions({ cancelScheduled, periodEnd }: { cancelScheduled: boolean; periodEnd: string | null }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (cancel: boolean) =>
    startTransition(async () => {
      const result = await setCancelAtPeriodEnd(cancel);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(cancel ? "Cancelamento agendado." : "Assinatura reativada.");
        router.refresh();
      }
    });

  if (cancelScheduled) {
    return (
      <Button variant="outline" disabled={pending} onClick={() => run(false)}>
        Manter assinatura
      </Button>
    );
  }
  return (
    <ConfirmDialog
      title="Cancelar a assinatura?"
      description={`Você continua com o plano atual até ${periodEnd ?? "o fim do período"}. Depois disso a organização volta ao plano Free e as automações acima do limite são pausadas.`}
      confirmLabel="Cancelar assinatura"
      onConfirm={() => run(true)}
    >
      <Button variant="ghost" disabled={pending} className="text-destructive">
        Cancelar assinatura
      </Button>
    </ConfirmDialog>
  );
}
