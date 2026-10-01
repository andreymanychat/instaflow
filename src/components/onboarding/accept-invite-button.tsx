"use client";

import { useState, useTransition } from "react";
import { acceptInvitation } from "@/server/actions/organization-actions";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ token, email }: { token: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <p className="text-sm text-muted-foreground">Conectado como {email}</p>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvitation(token);
            if (result && !result.ok) setError(result.error);
          })
        }
      >
        {pending ? "Aceitando..." : "Aceitar convite"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
}
