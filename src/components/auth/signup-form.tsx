"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { signUp } from "@/server/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/shared/form-error";

export function SignupForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signUp, null);

  if (state?.ok && state.data.needsConfirmation) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <MailCheck className="size-10 text-primary" />
        <h1 className="text-2xl font-semibold">Confirme seu email</h1>
        <p className="text-sm text-muted-foreground">
          Enviamos um link de confirmação. Depois de confirmar, você será levado para criar sua organização.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Criar conta</h1>
        <p className="text-sm text-muted-foreground">Grátis, sem cartão de crédito.</p>
      </div>
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="grid gap-2">
        <Label htmlFor="fullName">Nome</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <FormError result={state} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Criando..." : "Criar conta"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
      <p className="text-center text-xs text-muted-foreground">
        Ao continuar você concorda com os <Link href="/termos" className="underline">Termos</Link> e a{" "}
        <Link href="/privacidade" className="underline">Política de Privacidade</Link>.
      </p>
    </form>
  );
}
