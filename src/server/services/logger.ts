import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums, Json } from "@/types/database";

type LogInput = {
  organizationId?: string | null;
  level?: Enums<"log_level">;
  source: string;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
};

/**
 * Log estruturado persistido na tabela `logs` (visível na tela de Logs)
 * e espelhado no console (visível nos logs da Vercel).
 * Nunca lança exceção: falha de log não pode derrubar o fluxo principal.
 */
export async function log({ organizationId = null, level = "info", source, event, message, metadata = {} }: LogInput) {
  const line = `[${level}] ${source}.${event}: ${message}`;
  if (level === "error") console.error(line, metadata);
  else if (level === "warn") console.warn(line, metadata);
  else console.log(line);

  try {
    await createAdminClient()
      .from("logs")
      .insert({
        organization_id: organizationId,
        level,
        source,
        event,
        message: message.slice(0, 2000),
        metadata: JSON.parse(JSON.stringify(metadata)) as Json,
      });
  } catch (error) {
    console.error("Falha ao gravar log", error);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : JSON.stringify(error);
}
