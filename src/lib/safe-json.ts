/**
 * JSON.parse que preserva inteiros acima de 2^53 como string.
 * IDs do Instagram (ex.: 17841400000000000) perderiam precisão se virassem Number.
 * Usa o acesso ao texto-fonte do reviver (ES2025, disponível no Node 21+).
 */
export function parseJsonSafe<T = unknown>(text: string): T {
  return JSON.parse(text, (_key, value, context?: { source?: string }) => {
    if (typeof value === "number" && Number.isInteger(value) && !Number.isSafeInteger(value) && context?.source) {
      return context.source;
    }
    return value;
  }) as T;
}
