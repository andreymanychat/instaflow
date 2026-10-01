import type { KeywordMatch } from "@/types/flow";

/** Minúsculas, sem acentos e com espaços normalizados: "Olá  QUERO" -> "ola quero". */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesKeywords(text: string, keywords: string[], match: KeywordMatch): boolean {
  if (match === "any") return true;
  const normalized = normalizeText(text);
  if (!normalized) return false;

  return keywords
    .map(normalizeText)
    .filter(Boolean)
    .some((keyword) => {
      switch (match) {
        case "exact":
          return normalized === keyword;
        case "starts_with":
          return normalized.startsWith(keyword);
        case "contains": {
          // palavra/frase inteira: "eu quero" casa com "quero", mas "querosene" não
          const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normalized);
        }
      }
    });
}

export type TemplateVars = Record<string, string | null | undefined>;

/** Substitui {{variavel}} por valores do contato/contexto. Variáveis desconhecidas viram vazio. */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => vars[key.toLowerCase()] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export const TEMPLATE_VARIABLES = [
  { key: "first_name", label: "Primeiro nome" },
  { key: "name", label: "Nome completo" },
  { key: "username", label: "@usuário" },
  { key: "last_text", label: "Última mensagem/comentário" },
] as const;
