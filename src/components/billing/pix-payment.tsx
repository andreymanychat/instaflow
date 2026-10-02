"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { CopyField } from "@/components/shared/copy-field";
import { getPaymentStatus } from "@/server/actions/billing-actions";

type Props = {
  paymentId: string;
  payload: string;
  image: string;
  onPaid: () => void;
  onFailed?: (reason: string) => void;
};

/** QR Code + copia e cola, consultando o status a cada 5s até a confirmação. */
export function PixPayment({ paymentId, payload, image, onPaid, onFailed }: Props) {
  const callbacks = useRef({ onPaid, onFailed });
  useEffect(() => {
    callbacks.current = { onPaid, onFailed };
  });

  useEffect(() => {
    let active = true;
    const timer = setInterval(async () => {
      const result = await getPaymentStatus(paymentId);
      if (!active || !result.ok) return;
      if (result.data.status === "paid") {
        clearInterval(timer);
        callbacks.current.onPaid();
      } else if (result.data.status === "failed" || result.data.status === "canceled") {
        clearInterval(timer);
        callbacks.current.onFailed?.(result.data.failureReason ?? "Pagamento não concluído.");
      }
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [paymentId]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- imagem base64 gerada pelo Asaas */}
      <img src={`data:image/png;base64,${image}`} alt="QR Code Pix" className="size-56 rounded-lg border bg-white p-2" />
      <div className="w-full">
        <CopyField label="Pix copia e cola" value={payload} />
      </div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Aguardando o pagamento — a confirmação é automática.
      </p>
    </div>
  );
}
