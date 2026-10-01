"use client";

import { useOptimistic, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { setContactTag } from "@/server/actions/contact-actions";

type Tag = { id: string; name: string; color: string };

export function ContactTagEditor({ contactId, tags, assigned }: { contactId: string; tags: Tag[]; assigned: string[] }) {
  const [optimistic, setOptimistic] = useOptimistic(assigned, (state, { tagId, on }: { tagId: string; on: boolean }) =>
    on ? [...state, tagId] : state.filter((id) => id !== tagId),
  );
  const [, startTransition] = useTransition();

  const toggle = (tagId: string, on: boolean) =>
    startTransition(async () => {
      setOptimistic({ tagId, on });
      const result = await setContactTag(contactId, tagId, on);
      if (!result.ok) toast.error(result.error);
    });

  const current = tags.filter((t) => optimistic.includes(t.id));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {current.map((tag) => (
        <span key={tag.id} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
          <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
          {tag.name}
          <button type="button" aria-label={`Remover ${tag.name}`} onClick={() => toggle(tag.id, false)}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground">
            <Plus className="size-3" /> Tag
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          {tags.length === 0 && <p className="p-2 text-xs text-muted-foreground">Crie tags na página Contatos.</p>}
          {tags.map((tag) => (
            <label key={tag.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox checked={optimistic.includes(tag.id)} onCheckedChange={(v) => toggle(tag.id, v === true)} />
              <span className="size-2 rounded-full" style={{ backgroundColor: tag.color }} />
              {tag.name}
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
