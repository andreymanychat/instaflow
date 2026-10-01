"use client";

import { useActionState } from "react";
import { createOrganization } from "@/server/actions/organization-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/shared/form-error";

export function CreateOrganizationForm() {
  const [state, action, pending] = useActionState(createOrganization, null);
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Nome da empresa ou projeto</Label>
        <Input id="name" name="name" placeholder="Ex.: Loja da Maria" required minLength={2} maxLength={80} />
      </div>
      <FormError result={state} />
      <Button type="submit" disabled={pending}>{pending ? "Criando..." : "Continuar"}</Button>
    </form>
  );
}
