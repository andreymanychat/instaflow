"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount } from "@/server/actions/account-actions";

export function DeleteAccountCard({ email }: { email: string }) {
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const matches = confirm.trim().toLowerCase() === email.toLowerCase();

  const submit = () =>
    startTransition(async () => {
      // Em caso de sucesso a action redireciona para a página inicial
      const result = await deleteAccount(confirm);
      if (result && !result.ok) toast.error(result.error);
    });

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Excluir conta</CardTitle>
        <CardDescription>
          Apaga permanentemente o seu login e tudo o que foi criado por você: organizações em que você é o único dono (com contas do
          Instagram, contatos, conversas, automações e logs), cartões salvos, saldo da carteira, histórico de pagamentos e indicações.
          Assinaturas ativas são encerradas sem reembolso do período restante. Não é possível desfazer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog onOpenChange={() => setConfirm("")}>
          <DialogTrigger asChild>
            <Button variant="destructive">Excluir minha conta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir conta definitivamente?</DialogTitle>
              <DialogDescription>
                Para confirmar, digite seu email <strong className="text-foreground">{email}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="confirm-email">Email</Label>
              <Input id="confirm-email" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="destructive" disabled={!matches || pending} onClick={submit}>
                {pending ? "Excluindo..." : "Excluir tudo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
