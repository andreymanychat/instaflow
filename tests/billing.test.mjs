import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatCnpj,
  formatCpf,
  formatPhone,
  isValidCardNumber,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  isValidPhone,
} from "../src/lib/br.ts";
import { addOneMonth, nextPeriodEnd, splitWithWallet, toBrazilDate } from "../src/server/billing/pricing.ts";

test("CPF: aceita válidos (com ou sem máscara) e recusa inválidos", () => {
  assert.equal(isValidCpf("529.982.247-25"), true);
  assert.equal(isValidCpf("52998224725"), true);
  assert.equal(isValidCpf("52998224724"), false);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("123"), false);
});

test("CNPJ: aceita válidos e recusa inválidos", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(isValidCnpj("11222333000182"), false);
  assert.equal(isValidCnpj("00000000000000"), false);
});

test("telefone, CEP e máscaras", () => {
  assert.equal(isValidPhone("(11) 99999-8888"), true);
  assert.equal(isValidPhone("1133334444"), true);
  assert.equal(isValidPhone("11899998888"), false);
  assert.equal(isValidPhone("0199998888"), false);
  assert.equal(isValidCep("01310-100"), true);
  assert.equal(isValidCep("0131010"), false);
  assert.equal(formatCpf("52998224725"), "529.982.247-25");
  assert.equal(formatCnpj("11222333000181"), "11.222.333/0001-81");
  assert.equal(formatPhone("11999998888"), "(11) 99999-8888");
});

test("cartão: Luhn", () => {
  assert.equal(isValidCardNumber("4111 1111 1111 1111"), true);
  assert.equal(isValidCardNumber("4111 1111 1111 1112"), false);
});

test("carteira primeiro, diferença no cartão/Pix", () => {
  assert.deepEqual(splitWithWallet(5700, 0), { walletCents: 0, chargeCents: 5700 });
  assert.deepEqual(splitWithWallet(5700, 1000), { walletCents: 1000, chargeCents: 4700 });
  assert.deepEqual(splitWithWallet(5700, 9000), { walletCents: 5700, chargeCents: 0 });
  // Diferença de R$2 viraria cobrança abaixo do mínimo do Asaas: usa menos saldo
  assert.deepEqual(splitWithWallet(5700, 5500), { walletCents: 5200, chargeCents: 500 });
});

test("períodos mensais", () => {
  assert.equal(addOneMonth(new Date("2026-01-31T12:00:00Z")).toISOString(), "2026-02-28T12:00:00.000Z");
  assert.equal(addOneMonth(new Date("2026-10-01T12:00:00Z")).toISOString(), "2026-11-01T12:00:00.000Z");
  const now = new Date("2026-10-01T12:00:00Z");
  const end = new Date("2026-10-05T12:00:00Z");
  assert.equal(
    nextPeriodEnd({ now, currentPlanId: "pro", purchasedPlanId: "pro", currentPeriodEnd: end }).toISOString(),
    "2026-11-05T12:00:00.000Z",
    "renovação antecipada não perde dias",
  );
  assert.equal(
    nextPeriodEnd({ now, currentPlanId: "pro", purchasedPlanId: "business", currentPeriodEnd: end }).toISOString(),
    "2026-11-01T12:00:00.000Z",
    "troca de plano começa um novo período",
  );
  const vencido = new Date("2026-09-30T12:00:00Z");
  assert.equal(
    nextPeriodEnd({ now, currentPlanId: "pro", purchasedPlanId: "pro", currentPeriodEnd: vencido, isRenewal: true }).toISOString(),
    "2026-10-30T12:00:00.000Z",
    "renovação confirmada logo após o vencimento mantém o dia",
  );
  assert.equal(
    nextPeriodEnd({ now, currentPlanId: "free", purchasedPlanId: "pro", currentPeriodEnd: null }).toISOString(),
    "2026-11-01T12:00:00.000Z",
  );
  assert.equal(toBrazilDate(new Date("2026-10-02T01:00:00Z")), "2026-10-01");
});
