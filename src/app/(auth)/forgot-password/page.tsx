"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/server/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/shared/form-error";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  if (state?.ok) {
    return (
      <div className="flex flex-col gap-3 text-center">
        <h1 className="text-2xl font-semibold">Verifique seu email</h1>
        <p className="text-sm text-muted-foreground">Se existir uma conta com esse email, enviamos um link para redefinir a senha.</p>
        <Link href="/login" className="text-sm underline">Voltar ao login</Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Redefinir senha</h1>
        <p className="text-sm text-muted-foreground">Informe seu email para receber o link.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <FormError result={state} />
      <Button type="submit" disabled={pending}>{pending ? "Enviando..." : "Enviar link"}</Button>
      <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
        Voltar ao login
      </Link>
    </form>
  );
}
