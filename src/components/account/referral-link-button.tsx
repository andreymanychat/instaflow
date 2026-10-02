"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createReferralLink } from "@/server/actions/account-actions";

export function ReferralLinkButton({ appUrl }: { appUrl: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const generate = () =>
    startTransition(async () => {
      const result = await createReferralLink();
      if (!result.ok) return void toast.error(result.error);
      const url = `${appUrl}/r/${result.data.code}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link gerado e copiado. Válido por 3 dias.");
      } catch {
        toast.success("Link gerado. Válido por 3 dias.");
      }
      router.refresh();
    });

  return (
    <Button onClick={generate} disabled={pending}>
      <Link2 className="size-4" /> {pending ? "Gerando..." : "Gerar novo link"}
    </Button>
  );
}
