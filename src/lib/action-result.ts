import type { z } from "zod";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T = undefined>(data?: T): ActionResult<T> => ({ ok: true, data: data as T });
export const fail = (error: string): ActionResult<never> => ({ ok: false, error });

export function zodError(error: z.ZodError): ActionResult<never> {
  return fail(error.issues[0]?.message ?? "Dados inválidos.");
}

/** Converte exceções em ActionResult para que o cliente sempre receba uma mensagem legível. */
export async function safeAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    // redirect()/notFound() do Next lançam erros especiais que precisam propagar
    if (error && typeof error === "object" && "digest" in error) throw error;
    return fail(error instanceof Error ? error.message : "Erro inesperado.");
  }
}
