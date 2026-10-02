"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCardNumber, onlyDigits } from "@/lib/br";
import type { CardInput } from "@/server/actions/billing-actions";

export const EMPTY_CARD: CardInput = { holderName: "", number: "", expiry: "", ccv: "" };

function formatExpiry(value: string) {
  const digits = onlyDigits(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/**
 * Campos do cartão. Os dados vão direto para a action, que os repassa ao Asaas para tokenização
 * e os descarta: o ChatFlow guarda apenas o token, a bandeira e os 4 últimos dígitos.
 */
export function CardFields({ value, onChange }: { value: CardInput; onChange: (card: CardInput) => void }) {
  const set = (key: keyof CardInput, v: string) => onChange({ ...value, [key]: v });
  return (
    <div className="grid grid-cols-6 gap-3">
      <div className="col-span-6 space-y-1.5">
        <Label htmlFor="cc-number">Número do cartão</Label>
        <Input
          id="cc-number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="0000 0000 0000 0000"
          value={value.number}
          onChange={(e) => set("number", formatCardNumber(e.target.value))}
        />
      </div>
      <div className="col-span-6 space-y-1.5">
        <Label htmlFor="cc-name">Nome impresso no cartão</Label>
        <Input id="cc-name" autoComplete="cc-name" value={value.holderName} onChange={(e) => set("holderName", e.target.value.toUpperCase())} />
      </div>
      <div className="col-span-3 space-y-1.5">
        <Label htmlFor="cc-exp">Validade</Label>
        <Input
          id="cc-exp"
          inputMode="numeric"
          autoComplete="cc-exp"
          placeholder="MM/AA"
          value={value.expiry}
          onChange={(e) => set("expiry", formatExpiry(e.target.value))}
        />
      </div>
      <div className="col-span-3 space-y-1.5">
        <Label htmlFor="cc-csc">CVV</Label>
        <Input
          id="cc-csc"
          inputMode="numeric"
          autoComplete="cc-csc"
          placeholder="123"
          value={value.ccv}
          onChange={(e) => set("ccv", onlyDigits(e.target.value).slice(0, 4))}
        />
      </div>
    </div>
  );
}
