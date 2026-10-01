import { cn } from "@/lib/utils";
import type { Enums } from "@/types/database";

const STYLES: Record<Enums<"log_level">, string> = {
  debug: "bg-muted text-muted-foreground",
  info: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  warn: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  error: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function LogLevelBadge({ level, compact }: { level: Enums<"log_level">; compact?: boolean }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", STYLES[level], compact && "mt-0.5")}>
      {level}
    </span>
  );
}
