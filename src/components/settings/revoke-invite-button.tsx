"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revokeInvitation } from "@/server/actions/organization-actions";

export function RevokeInviteButton({ id, inviteUrl }: { id: string; inviteUrl: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Copiar link"
        onClick={async () => {
          await navigator.clipboard.writeText(inviteUrl);
          toast.success("Link copiado.");
        }}
      >
        <Copy className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Cancelar convite"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await revokeInvitation(id);
            router.refresh();
          })
        }
      >
        <X className="size-4" />
      </Button>
    </>
  );
}
