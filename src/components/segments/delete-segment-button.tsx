"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deleteSegment } from "@/server/actions/contact-actions";

export function DeleteSegmentButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <ConfirmDialog
      title={`Excluir “${name}”?`}
      description="Os contatos não são apagados, apenas o segmento."
      confirmLabel="Excluir"
      onConfirm={() =>
        startTransition(async () => {
          const result = await deleteSegment(id);
          if (!result.ok) toast.error(result.error);
          router.refresh();
        })
      }
    >
      <Button size="sm" variant="ghost" disabled={pending}>
        <Trash2 className="size-4" /> Excluir
      </Button>
    </ConfirmDialog>
  );
}
