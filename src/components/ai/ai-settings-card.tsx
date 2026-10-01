"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateAiSettings } from "@/server/actions/organization-actions";

type Props = {
  canEdit: boolean;
  enabled: boolean;
  defaultPromptId: string | null;
  prompts: { id: string; name: string }[];
};

export function AiSettingsCard({ canEdit, enabled: initialEnabled, defaultPromptId: initialPrompt, prompts }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [promptId, setPromptId] = useState(initialPrompt);
  const [pending, startTransition] = useTransition();

  const persist = (next: { enabled: boolean; promptId: string | null }) =>
    startTransition(async () => {
      const result = await updateAiSettings({ autoReplyEnabled: next.enabled, defaultPromptId: next.promptId });
      if (!result.ok) {
        toast.error(result.error);
        setEnabled(initialEnabled);
        setPromptId(initialPrompt);
      } else toast.success("Configuração salva.");
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resposta automática</CardTitle>
        <CardDescription>A IA responde DMs que não casarem com nenhuma automação de palavra-chave.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="ai-auto">Ativar IA no Direct</Label>
          <Switch
            id="ai-auto"
            checked={enabled}
            disabled={!canEdit || pending}
            onCheckedChange={(value) => {
              setEnabled(value);
              persist({ enabled: value, promptId });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Prompt padrão</Label>
          <Select
            value={promptId ?? "builtin"}
            disabled={!canEdit || pending}
            onValueChange={(value) => {
              const next = value === "builtin" ? null : value;
              setPromptId(next);
              persist({ enabled, promptId: next });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="builtin">Prompt interno do sistema</SelectItem>
              {prompts.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Quando um atendente responde manualmente, a IA pausa naquela conversa pelo tempo definido em Configurações.
        </p>
      </CardContent>
    </Card>
  );
}
