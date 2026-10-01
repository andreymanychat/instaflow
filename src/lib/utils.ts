import { differenceInCalendarDays, format, formatDistanceToNowStrict, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export { cn } from "cn";

const toDate = (value: string | Date) => (typeof value === "string" ? parseISO(value) : value);

/** "há 5 minutos" */
export function formatRelative(value: string | Date) {
  return formatDistanceToNowStrict(toDate(value), { addSuffix: true, locale: ptBR });
}

/** 14:32 hoje, "seg" na semana, 12/03 depois disso. */
export function formatShortTime(value: string | Date) {
  const date = toDate(value);
  if (isToday(date)) return format(date, "HH:mm");
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, "EEE HH:mm", { locale: ptBR });
  return format(date, "dd/MM/yy");
}

export function formatDate(value: string | Date) {
  return format(toDate(value), "dd/MM/yyyy");
}

export function formatDateTime(value: string | Date) {
  return format(toDate(value), "dd/MM/yy HH:mm:ss");
}

export function formatCurrency(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export function initials(value: string) {
  return (
    value
      .replace(/^@/, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}
