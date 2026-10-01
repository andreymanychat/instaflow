import { AlertCircle } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";

export function FormError({ result }: { result: ActionResult<unknown> | null | undefined }) {
  if (!result || result.ok) return null;
  return (
    <p role="alert" className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" />
      {result.error}
    </p>
  );
}
