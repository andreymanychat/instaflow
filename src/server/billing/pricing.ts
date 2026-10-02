/**
 * Regras puras de cobrança (sem I/O), testadas em tests/billing.test.mjs.
 * Valores sempre em centavos.
 */

/** O Asaas não aceita cobranças abaixo de R$ 5,00. */
export const MIN_CHARGE_CENTS = 500;
export const REFERRAL_REWARD_CENTS = 1000;
export const MIN_TOPUP_CENTS = 1000;
export const MAX_TOPUP_CENTS = 500_000;
/** Pix da renovação é gerado com esta antecedência (dias). */
export const RENEWAL_PIX_DAYS_BEFORE = 3;
export const REFERRAL_LINK_DAYS = 3;

/**
 * Divide o valor entre saldo da carteira e cobrança externa (saldo primeiro).
 * Se a diferença ficar abaixo do mínimo do Asaas, usa menos saldo para que a
 * cobrança externa atinja exatamente o mínimo.
 */
export function splitWithWallet(priceCents: number, balanceCents: number) {
  const balance = Math.max(0, balanceCents);
  let wallet = Math.min(balance, priceCents);
  let charge = priceCents - wallet;
  if (charge > 0 && charge < MIN_CHARGE_CENTS) {
    charge = Math.min(MIN_CHARGE_CENTS, priceCents);
    wallet = priceCents - charge;
  }
  return { walletCents: wallet, chargeCents: charge };
}

/** Soma 1 mês preservando o dia (31/01 → 28/02 ou 29/02). */
export function addOneMonth(date: Date) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

/** Tolerância para a renovação manter o dia de vencimento mesmo confirmada um pouco depois. */
const RENEWAL_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Novo fim de período após um pagamento confirmado.
 * Mesmo plano ainda vigente (ou renovação confirmada logo após o vencimento): soma 1 mês ao fim atual.
 * Compra nova, troca de plano ou período vencido há mais tempo: 1 mês a partir de agora.
 */
export function nextPeriodEnd(params: {
  now: Date;
  currentPlanId: string;
  purchasedPlanId: string;
  currentPeriodEnd: Date | null;
  isRenewal?: boolean;
}) {
  const { now, currentPlanId, purchasedPlanId, currentPeriodEnd, isRenewal = false } = params;
  if (currentPlanId === purchasedPlanId && currentPeriodEnd) {
    const threshold = isRenewal ? now.getTime() - RENEWAL_GRACE_MS : now.getTime();
    if (currentPeriodEnd.getTime() > threshold) return addOneMonth(currentPeriodEnd);
  }
  return addOneMonth(now);
}

/** Data (YYYY-MM-DD) no fuso de São Paulo, formato exigido pelo Asaas em dueDate. */
export function toBrazilDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}
