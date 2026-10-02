"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UFS, formatCep, formatDocument, formatPhone, isValidDocument, onlyDigits } from "@/lib/br";
import { updateProfile, type ProfileInput } from "@/server/actions/account-actions";

type Values = Omit<ProfileInput, "personType" | "state" | "companyName" | "complement"> & {
  personType: "pf" | "pj";
  state: string;
  companyName: string;
  complement: string;
};

export function ProfileForm({ initial, email }: { initial: Values; email: string }) {
  const [values, setValues] = useState<Values>({
    ...initial,
    document: formatDocument(initial.document, initial.personType),
    phone: formatPhone(initial.phone),
    postalCode: formatCep(initial.postalCode),
  });
  const [pending, startTransition] = useTransition();
  const [lookingUp, setLookingUp] = useState(false);
  const router = useRouter();

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  const documentDigits = onlyDigits(values.document);
  const documentComplete = documentDigits.length === (values.personType === "pf" ? 11 : 14);
  const documentInvalid = documentComplete && !isValidDocument(documentDigits, values.personType);

  /** Preenche o endereço pelo CEP (ViaCEP, serviço público e gratuito). */
  async function lookupCep(cep: string) {
    const digits = onlyDigits(cep);
    if (digits.length !== 8) return;
    setLookingUp(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await response.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (data.erro) {
        toast.error("CEP não encontrado.");
        return;
      }
      setValues((v) => ({
        ...v,
        street: data.logradouro || v.street,
        district: data.bairro || v.district,
        city: data.localidade || v.city,
        state: data.uf || v.state,
      }));
    } catch {
      // Sem internet/ViaCEP fora do ar: o usuário preenche manualmente
    } finally {
      setLookingUp(false);
    }
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await updateProfile({ ...values, state: values.state as ProfileInput["state"] });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success("Perfil salvo.");
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit}>
      <Card>
        <CardHeader>
          <CardTitle>Dados cadastrais</CardTitle>
          <CardDescription>Usados na emissão das cobranças (exigência do meio de pagamento). Visíveis somente para você.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-2 sm:col-span-4">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" value={values.fullName} onChange={(e) => set("fullName", e.target.value)} autoComplete="name" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Tipo de pessoa</Label>
            <Select
              value={values.personType}
              onValueChange={(value: "pf" | "pj") => setValues((v) => ({ ...v, personType: value, document: formatDocument(v.document, value) }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pf">Pessoa física</SelectItem>
                <SelectItem value="pj">Pessoa jurídica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="document">{values.personType === "pf" ? "CPF" : "CNPJ"}</Label>
            <Input
              id="document"
              inputMode="numeric"
              value={values.document}
              onChange={(e) => set("document", formatDocument(e.target.value, values.personType))}
              placeholder={values.personType === "pf" ? "000.000.000-00" : "00.000.000/0000-00"}
              aria-invalid={documentInvalid}
              required
            />
            {documentInvalid && <p className="text-xs text-destructive">{values.personType === "pf" ? "CPF inválido." : "CNPJ inválido."}</p>}
          </div>
          {values.personType === "pj" && (
            <div className="space-y-2 sm:col-span-4">
              <Label htmlFor="companyName">Razão social</Label>
              <Input id="companyName" value={values.companyName} onChange={(e) => set("companyName", e.target.value)} required />
            </div>
          )}

          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled />
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="tel-national"
              value={values.phone}
              onChange={(e) => set("phone", formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="postalCode">CEP</Label>
            <div className="relative">
              <Input
                id="postalCode"
                inputMode="numeric"
                autoComplete="postal-code"
                value={values.postalCode}
                onChange={(e) => {
                  const cep = formatCep(e.target.value);
                  set("postalCode", cep);
                  if (onlyDigits(cep).length === 8) void lookupCep(cep);
                }}
                placeholder="00000-000"
                required
              />
              {lookingUp && <Loader2 className="absolute top-2.5 right-2.5 size-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div className="space-y-2 sm:col-span-4">
            <Label htmlFor="street">Endereço</Label>
            <Input id="street" autoComplete="address-line1" value={values.street} onChange={(e) => set("street", e.target.value)} required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="addressNumber">Número</Label>
            <Input id="addressNumber" value={values.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} required />
          </div>
          <div className="space-y-2 sm:col-span-4">
            <Label htmlFor="complement">Complemento (opcional)</Label>
            <Input id="complement" autoComplete="address-line2" value={values.complement} onChange={(e) => set("complement", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="district">Bairro</Label>
            <Input id="district" value={values.district} onChange={(e) => set("district", e.target.value)} required />
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" autoComplete="address-level2" value={values.city} onChange={(e) => set("city", e.target.value)} required />
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label>UF</Label>
            <Select value={values.state} onValueChange={(value) => set("state", value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {UFS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={pending || documentInvalid}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
