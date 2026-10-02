/** Validação e máscaras de documentos e contatos brasileiros (sem dependências: roda no cliente e no servidor). */

export const onlyDigits = (value: string) => value.replace(/\D/g, "");

const allSameDigits = (digits: string) => /^(\d)\1+$/.test(digits);

export function isValidCpf(value: string) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || allSameDigits(cpf)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export function isValidCnpj(value: string) {
  const cnpj = onlyDigits(value);
  if (cnpj.length !== 14 || allSameDigits(cnpj)) return false;
  const digit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, i) => acc + Number(cnpj[i]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return digit(12) === Number(cnpj[12]) && digit(13) === Number(cnpj[13]);
}

export function isValidDocument(value: string, personType: "pf" | "pj") {
  return personType === "pf" ? isValidCpf(value) : isValidCnpj(value);
}

/** Celular (11 dígitos, 9 após o DDD) ou fixo (10 dígitos), com DDD válido. */
export function isValidPhone(value: string) {
  const phone = onlyDigits(value);
  if (!/^[1-9][1-9]\d{8,9}$/.test(phone)) return false;
  return phone.length === 10 || phone[2] === "9";
}

export const isValidCep = (value: string) => /^\d{8}$/.test(onlyDigits(value));

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB",
  "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
] as const;

function mask(digits: string, pattern: string) {
  let out = "";
  let i = 0;
  for (const char of pattern) {
    if (i >= digits.length) break;
    out += char === "#" ? digits[i++] : char;
  }
  return out;
}

export const formatCpf = (value: string) => mask(onlyDigits(value).slice(0, 11), "###.###.###-##");
export const formatCnpj = (value: string) => mask(onlyDigits(value).slice(0, 14), "##.###.###/####-##");
export const formatDocument = (value: string, personType: "pf" | "pj") =>
  personType === "pf" ? formatCpf(value) : formatCnpj(value);
export const formatCep = (value: string) => mask(onlyDigits(value).slice(0, 8), "#####-###");

export function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  return digits.length <= 10 ? mask(digits, "(##) ####-####") : mask(digits, "(##) #####-####");
}

/** Número do cartão: Luhn. */
export function isValidCardNumber(value: string) {
  const digits = onlyDigits(value);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let n = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

export const formatCardNumber = (value: string) => onlyDigits(value).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
