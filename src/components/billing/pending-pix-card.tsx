"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PixPayment } from "@/components/billing/pix-payment";

type Props = { paymentId: string; payload: string; image: string; title: string; description: string };

export function PendingPixCard({ paymentId, payload, image, title, description }: Props) {
  const router = useRouter();
  return (
    <Card className="border-amber-500/50">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mx-auto w-full max-w-sm">
        <PixPayment
          paymentId={paymentId}
          payload={payload}
          image={image}
          onPaid={() => {
            toast.success("Pagamento confirmado!");
            router.refresh();
          }}
          onFailed={() => router.refresh()}
        />
      </CardContent>
    </Card>
  );
}
