import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

const STATUS: Record<Enums<"automation_status">, { label: string; className: string }> = {
  active: { label: "Ativa", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  paused: { label: "Pausada", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
};

export function AutomationStatusBadge({ status }: { status: Enums<"automation_status"> }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", s.className)}>
      <span className={cn("size-1.5 rounded-full", status === "active" ? "bg-emerald-500" : status === "paused" ? "bg-amber-500" : "bg-muted-foreground")} />
      {s.label}
    </span>
  );
}
