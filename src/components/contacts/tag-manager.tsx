"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { createTag, deleteTag, updateTag } from "@/server/actions/contact-actions";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#0ea5e9", "#64748b"];

type Tag = { id: string; name: string; color: string };

export function TagManager({ tags }: { tags: Tag[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const reset = () => {
    setName("");
    setColor(COLORS[0]);
    setEditingId(null);
  };

  const submit = () =>
    startTransition(async () => {
      const result = editingId ? await updateTag(editingId, { name, color }) : await createTag({ name, color });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(editingId ? "Tag atualizada." : "Tag criada.");
      reset();
      router.refresh();
    });

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await deleteTag(id);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });

  return (
    <Dialog onOpenChange={(open) => !open && reset()}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Tags className="size-4" /> Gerenciar tags
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tags</DialogTitle>
          <DialogDescription>Use tags para segmentar contatos e criar condições nos fluxos.</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da tag" maxLength={50} />
            <Button type="submit" disabled={pending || !name.trim()}>{editingId ? "Salvar" : "Criar"}</Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Cor ${c}`}
                onClick={() => setColor(c)}
                className="size-6 rounded-full ring-offset-2 ring-offset-background"
                style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px ${c}` : undefined }}
              />
            ))}
          </div>
        </form>

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {tags.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma tag criada.</p>}
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted">
              <span className="size-3 rounded-full" style={{ backgroundColor: tag.color }} />
              <span className="flex-1 text-sm">{tag.name}</span>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Editar"
                onClick={() => {
                  setEditingId(tag.id);
                  setName(tag.name);
                  setColor(tag.color);
                }}
              >
                <Pencil className="size-4" />
              </Button>
              <ConfirmDialog
                title={`Excluir a tag “${tag.name}”?`}
                description="Ela será removida de todos os contatos. Condições que usam esta tag deixarão de funcionar."
                confirmLabel="Excluir"
                onConfirm={() => remove(tag.id)}
              >
                <Button size="icon" variant="ghost" aria-label="Excluir">
                  <Trash2 className="size-4" />
                </Button>
              </ConfirmDialog>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
