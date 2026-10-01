"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Copy, MoreHorizontal, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteAutomation, duplicateAutomation, setAutomationStatus } from "@/server/actions/automation-actions";
import type { Enums } from "@/types/database";
import type { ActionResult } from "@/lib/action-result";

export function AutomationRowActions({ id, status }: { id: string; status: Enums<"automation_status"> }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const run = <T,>(action: () => Promise<ActionResult<T>>, success: string) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(success);
      else toast.error(result.error);
      router.refresh();
    });

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={status === "active" ? "Pausar" : "Ativar"}
        onClick={() =>
          run(() => setAutomationStatus(id, status === "active" ? "paused" : "active"), status === "active" ? "Automação pausada." : "Automação ativada!")
        }
      >
        {status === "active" ? <Pause className="size-4" /> : <Play className="size-4" />}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Mais ações" disabled={pending}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/automations/${id}`}>
              <Pencil className="size-4" /> Editar
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => run(() => duplicateAutomation(id), "Automação duplicada.")}>
            <Copy className="size-4" /> Duplicar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <ConfirmDialog
            title="Excluir automação?"
            description="O histórico de execuções também será apagado. Esta ação não pode ser desfeita."
            confirmLabel="Excluir"
            onConfirm={() => run(() => deleteAutomation(id), "Automação excluída.")}
          >
            <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
              <Trash2 className="size-4" /> Excluir
            </DropdownMenuItem>
          </ConfirmDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
