"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyField } from "@/components/shared/copy-field";
import { updateOrganization } from "@/server/actions/organization-actions";

type Props = {
  canEdit: boolean;
  initial: { name: string; humanTakeoverMinutes: number };
  webhookUrl: string;
};

export function OrganizationForm({ canEdit, initial, webhookUrl }: Props) {
  const [values, setValues] = useState(initial);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () =>
    startTransition(async () => {
      const result = await updateOrganization(values);
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Configurações salvas.");
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Organização</CardTitle>
          <CardDescription>Dados gerais e comportamento do atendimento.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">Nome</Label>
            <Input id="org-name" value={values.name} disabled={!canEdit} onChange={(e) => setValues({ ...values, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="takeover">Pausa do bot após resposta humana (minutos)</Label>
            <Input
              id="takeover"
              type="number"
              min={0}
              max={10080}
              className="w-40"
              value={values.humanTakeoverMinutes}
              disabled={!canEdit}
              onChange={(e) => setValues({ ...values, humanTakeoverMinutes: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Quando alguém da equipe responde (pelo painel ou pelo app do Instagram), automações e IA param nessa conversa por este tempo. 0 = nunca pausar.
            </p>
          </div>
        </CardContent>
        {canEdit && (
          <CardFooter>
            <Button onClick={submit} disabled={pending}>Salvar</Button>
          </CardFooter>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integração com a Meta</CardTitle>
          <CardDescription>URLs para configurar no app do Meta Developer.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <CopyField label="URL de callback do webhook" value={webhookUrl} />
          <CopyField label="URI de redirecionamento OAuth" value={webhookUrl.replace("/api/webhook", "/api/oauth/callback")} />
          <CopyField label="URI de desautorização" value={webhookUrl.replace("/api/webhook", "/api/oauth/deauthorize")} />
          <CopyField label="URI de exclusão de dados" value={webhookUrl.replace("/api/webhook", "/exclusao-de-dados")} />
        </CardContent>
      </Card>
    </div>
  );
}
