"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

/** Exibe o resultado do OAuth (vindo por querystring) e limpa a URL. */
export function OAuthResultToast({ connected, error }: { connected: string | null; error: string | null }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!connected && !error) return;
    if (connected) toast.success(`@${connected} conectada com sucesso!`);
    if (error) toast.error(error);
    router.replace(pathname);
  }, [connected, error, pathname, router]);

  return null;
}
