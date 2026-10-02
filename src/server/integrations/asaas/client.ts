import "server-only";
import { env } from "@/lib/env";

/**
 * Cliente mínimo da API v3 do Asaas (https://docs.asaas.com).
 * Usamos fetch direto: as rotas necessárias são poucas e o SDK oficial não é mantido para Node.
 * Dados de cartão passam por aqui apenas em memória, a caminho da tokenização — nunca são gravados nem logados.
 */

export class AsaasError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "AsaasError";
  }
}

const baseUrl = () =>
  env().ASAAS_ENVIRONMENT === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

async function request<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  const apiKey = env().ASAAS_API_KEY;
  if (!apiKey) throw new AsaasError("Pagamentos não configurados (ASAAS_API_KEY ausente).", 503);

  const response = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "ChatFlow",
      access_token: apiKey,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : {};
  if (!response.ok) {
    const first = (data as { errors?: { code?: string; description?: string }[] }).errors?.[0];
    throw new AsaasError(first?.description ?? `Asaas respondeu ${response.status}`, response.status, first?.code);
  }
  return data as T;
}

// ---- Clientes -------------------------------------------------------------------

export type AsaasCustomerInput = {
  name: string;
  cpfCnpj: string;
  email: string;
  mobilePhone?: string;
  phone?: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  complement?: string;
  province: string;
  externalReference: string;
  notificationDisabled?: boolean;
};

export const createCustomer = (input: AsaasCustomerInput) => request<{ id: string }>("POST", "/customers", input);

export const updateCustomer = (id: string, input: Partial<AsaasCustomerInput>) =>
  request<{ id: string }>("POST", `/customers/${encodeURIComponent(id)}`, input);

export const deleteCustomer = (id: string) => request<{ deleted: boolean }>("DELETE", `/customers/${encodeURIComponent(id)}`);

// ---- Cartão ---------------------------------------------------------------------

export type CardInput = { holderName: string; number: string; expiryMonth: string; expiryYear: string; ccv: string };
export type CardHolderInfo = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string;
  phone: string;
  mobilePhone?: string;
};

export const tokenizeCard = (input: { customer: string; creditCard: CardInput; creditCardHolderInfo: CardHolderInfo; remoteIp: string }) =>
  request<{ creditCardToken: string; creditCardNumber: string; creditCardBrand: string }>(
    "POST",
    "/creditCard/tokenizeCreditCard",
    input,
  );

// ---- Cobranças ------------------------------------------------------------------

export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "RECEIVED_IN_CASH"
  | "REFUND_REQUESTED"
  | "REFUND_IN_PROGRESS"
  | "CHARGEBACK_REQUESTED"
  | "CHARGEBACK_DISPUTE"
  | "AWAITING_CHARGEBACK_REVERSAL"
  | "DUNNING_REQUESTED"
  | "DUNNING_RECEIVED"
  | "AWAITING_RISK_ANALYSIS";

export type AsaasPayment = {
  id: string;
  customer: string;
  value: number;
  status: AsaasPaymentStatus;
  billingType: "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";
  dueDate: string;
  invoiceUrl?: string;
  externalReference?: string | null;
  deleted?: boolean;
};

export const PAID_STATUSES: AsaasPaymentStatus[] = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

export const createPayment = (input: {
  customer: string;
  billingType: "PIX" | "CREDIT_CARD";
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
  creditCardToken?: string;
  remoteIp?: string;
}) => request<AsaasPayment>("POST", "/payments", input);

export const getPayment = (id: string) => request<AsaasPayment>("GET", `/payments/${encodeURIComponent(id)}`);

export const deletePayment = (id: string) => request<{ deleted: boolean }>("DELETE", `/payments/${encodeURIComponent(id)}`);

// ---- Notas fiscais (NFS-e) --------------------------------------------------------

export const scheduleInvoice = (input: {
  payment: string;
  serviceDescription: string;
  observations: string;
  externalReference: string;
  value: number;
  deductions: number;
  effectiveDate: string;
  municipalServiceId?: string;
  municipalServiceCode?: string;
  municipalServiceName: string;
  taxes: { retainIss: boolean; iss: number; pis: number; cofins: number; csll: number; inss: number; ir: number };
}) => request<{ id: string; status: string }>("POST", "/invoices", input);

export const getPixQrCode = (id: string) =>
  request<{ encodedImage: string; payload: string; expirationDate: string }>(
    "GET",
    `/payments/${encodeURIComponent(id)}/pixQrCode`,
  );
