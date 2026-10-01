"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AUTOMATION_TEMPLATES, TRIGGER_LABELS, type AutomationTemplateId } from "@/lib/automation-templates";
import { createAutomation } from "@/server/actions/automation-actions";
import { cn } from "@/lib/utils";

export function NewAutomationDialog({ defaultTemplate }: { defaultTemplate?: AutomationTemplateId }) {
  // abre direto quando vem de um atalho (ex.: /automations?new=comment_to_dm)
  const [open, setOpen] = useState(Boolean(defaultTemplate));
  const [creating, setCreating] = useState<AutomationTemplateId | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const create = (templateId: AutomationTemplateId) => {
    setCreating(templateId);
    startTransition(async () => {
      const result = await createAutomation(templateId);
      if (!result.ok) {
        toast.error(result.error);
        setCreating(null);
        return;
      }
      router.push(`/automations/${result.data.id}`);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nova automação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Escolha um modelo</DialogTitle>
          <DialogDescription>Todos os modelos podem ser editados depois no construtor visual.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {AUTOMATION_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              disabled={creating !== null}
              onClick={() => create(template.id)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-60",
                defaultTemplate === template.id && "border-primary",
              )}
            >
              <span className="flex w-full items-center justify-between text-sm font-semibold">
                {template.name}
                {creating === template.id && <Loader2 className="size-4 animate-spin" />}
              </span>
              <span className="text-xs text-muted-foreground">{template.description}</span>
              <span className="mt-2 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {TRIGGER_LABELS[template.triggerType]}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
