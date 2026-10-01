"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { deletePrompt, savePrompt, type PromptInput } from "@/server/actions/ai-actions";
import type { Tables } from "@/types/database";

type Prompt = Tables<"ai_prompts">;

type Props = {
  canEdit: boolean;
  prompts: Prompt[];
  defaultPromptId: string | null;
  template: { systemPrompt: string; model: string };
};

export function PromptList({ canEdit, prompts, defaultPromptId, template }: Props) {
  const [editing, setEditing] = useState<{ id: string | null; input: PromptInput } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const openNew = () =>
    setEditing({
      id: null,
      input: { name: "Atendimento", systemPrompt: template.systemPrompt, model: template.model, temperature: 0.7, maxOutputTokens: 400, historyLimit: 12 },
    });

  const openEdit = (p: Prompt) =>
    setEditing({
      id: p.id,
      input: {
        name: p.name,
        systemPrompt: p.system_prompt,
        model: p.model,
        temperature: Number(p.temperature),
        maxOutputTokens: p.max_output_tokens,
        historyLimit: p.history_limit,
      },
    });

  const submit = () =>
    editing &&
    startTransition(async () => {
      const result = await savePrompt(editing.id, editing.input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Prompt salvo.");
      setEditing(null);
      router.refresh();
    });

  const set = (patch: Partial<PromptInput>) => setEditing((e) => (e ? { ...e, input: { ...e.input, ...patch } } : e));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Prompts</CardTitle>
          <CardDescription>Defina a personalidade, as regras e o conhecimento da IA (produtos, preços, horários, FAQ).</CardDescription>
        </div>
        {canEdit && (
          <Button onClick={openNew}>
            <Plus className="size-4" /> Novo prompt
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {prompts.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhum prompt criado. O prompt interno do sistema será usado.</p>}
        {prompts.map((prompt) => (
          <div key={prompt.id} className="flex items-start gap-3 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-medium">
                {prompt.name}
                {prompt.id === defaultPromptId && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <Star className="size-3" /> Padrão
                  </span>
                )}
              </p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{prompt.system_prompt}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {prompt.model} · temperatura {Number(prompt.temperature)} · histórico de {prompt.history_limit} mensagens
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => openEdit(prompt)}>
                  <Pencil className="size-4" />
                </Button>
                <ConfirmDialog
                  title={`Excluir “${prompt.name}”?`}
                  description="Fluxos que usam este prompt passarão a usar o prompt padrão."
                  confirmLabel="Excluir"
                  onConfirm={() =>
                    startTransition(async () => {
                      await deletePrompt(prompt.id);
                      router.refresh();
                    })
                  }
                >
                  <Button size="icon" variant="ghost" aria-label="Excluir">
                    <Trash2 className="size-4" />
                  </Button>
                </ConfirmDialog>
              </div>
            )}
          </div>
        ))}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar prompt" : "Novo prompt"}</DialogTitle>
            <DialogDescription>Escreva como se estivesse treinando um atendente novo.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={editing.input.name} onChange={(e) => set({ name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Modelo OpenAI</Label>
                  <Input value={editing.input.model} onChange={(e) => set({ model: e.target.value })} placeholder="gpt-5-mini" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Instruções (system prompt)</Label>
                <Textarea rows={10} value={editing.input.systemPrompt} onChange={(e) => set({ systemPrompt: e.target.value })} />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Temperatura</Label>
                  <Input type="number" step={0.1} min={0} max={2} value={editing.input.temperature} onChange={(e) => set({ temperature: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Máx. tokens</Label>
                  <Input type="number" min={50} max={4000} value={editing.input.maxOutputTokens} onChange={(e) => set({ maxOutputTokens: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>Histórico</Label>
                  <Input type="number" min={0} max={50} value={editing.input.historyLimit} onChange={(e) => set({ historyLimit: Number(e.target.value) })} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Modelos de raciocínio (gpt-5*, o*) ignoram a temperatura.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={pending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
