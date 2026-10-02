import type { Tables } from "@/types/database";

/** Campos exigidos pelo Asaas para emitir cobranças e tokenizar cartões. */
const REQUIRED: { key: keyof Tables<"profiles">; label: string }[] = [
  { key: "full_name", label: "nome completo" },
  { key: "person_type", label: "tipo de pessoa" },
  { key: "document", label: "CPF/CNPJ" },
  { key: "phone", label: "telefone" },
  { key: "postal_code", label: "CEP" },
  { key: "street", label: "endereço" },
  { key: "address_number", label: "número" },
  { key: "district", label: "bairro" },
  { key: "city", label: "cidade" },
  { key: "state", label: "UF" },
];

export function missingProfileFields(profile: Partial<Tables<"profiles">> | null) {
  return REQUIRED.filter(({ key }) => !profile?.[key]).map(({ label }) => label);
}
