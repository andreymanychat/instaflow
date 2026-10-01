"use client";

import { useActionState } from "react";
import { updatePassword } from "@/server/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/shared/form-error";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <form action={action} className="flex w-full max-w-sm flex-col gap-6">
        <h1 className="text-2xl font-semibold">Nova senha</h1>
        <div className="grid gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <FormError result={state} />
        <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar senha"}</Button>
      </form>
    </div>
  );
}
