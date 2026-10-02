"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CardFields, EMPTY_CARD } from "@/components/billing/card-fields";
import { addCard, removeCard, setDefaultCard } from "@/server/actions/billing-actions";
import type { SavedCard } from "@/components/billing/checkout-dialog";

export function SavedCards({ cards, canAdd }: { cards: SavedCard[]; canAdd: boolean }) {
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState(EMPTY_CARD);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) toast.error(result.error ?? "Erro.");
      else {
        toast.success(success);
        after?.();
        router.refresh();
      }
    });

  return (
    <div className="space-y-3">
      {cards.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cartão salvo.</p>}
      {cards.map((c) => (
        <div key={c.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
          <CreditCard className="size-4 text-muted-foreground" />
          <span className="flex-1">
            {c.brand ?? "Cartão"} •••• {c.last4}
          </span>
          {c.is_default ? (
            <Badge variant="secondary">Padrão</Badge>
          ) : (
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setDefaultCard(c.id), "Cartão padrão atualizado.")}>
              Tornar padrão
            </Button>
          )}
          <ConfirmDialog
            title="Remover cartão?"
            description="Se for o único cartão, as próximas renovações serão feitas com saldo ou por Pix."
            confirmLabel="Remover"
            onConfirm={() => run(() => removeCard(c.id), "Cartão removido.")}
          >
            <Button size="icon" variant="ghost" aria-label="Remover cartão" disabled={pending}>
              <Trash2 className="size-4" />
            </Button>
          </ConfirmDialog>
        </div>
      ))}

      {canAdd && (
        <Dialog
          open={open}
          onOpenChange={(value) => {
            setOpen(value);
            if (!value) setCard(EMPTY_CARD);
          }}
        >
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="size-4" /> Adicionar cartão
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar cartão de crédito</DialogTitle>
              <DialogDescription>O cartão é validado e guardado de forma segura pelo Asaas. Nada é cobrado agora.</DialogDescription>
            </DialogHeader>
            <CardFields value={card} onChange={setCard} />
            <DialogFooter>
              <Button
                className="w-full"
                disabled={pending}
                onClick={() => run(() => addCard(card), "Cartão adicionado.", () => setOpen(false))}
              >
                {pending ? "Salvando..." : "Salvar cartão"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
