import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/types/database";

const LABELS: Record<Tables<"payments">["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  failed: { label: "Falhou", variant: "destructive" },
  refunded: { label: "Estornado", variant: "outline" },
  canceled: { label: "Cancelado", variant: "outline" },
};

export const METHOD_LABELS: Record<Tables<"payments">["method"], string> = { pix: "Pix", card: "Cartão", wallet: "Saldo" };

export function PaymentStatusBadge({ status }: { status: Tables<"payments">["status"] }) {
  const { label, variant } = LABELS[status];
  return <Badge variant={variant}>{label}</Badge>;
}
