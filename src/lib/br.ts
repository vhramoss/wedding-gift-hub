export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskCPF(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function isValidCPF(value: string): boolean {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

export type PaymentMethod = "pix" | "debit" | "credit";

/** Juros mensais aplicados no parcelamento do cartão de crédito. */
export function monthlyRate(installments: number): number {
  if (installments <= 1) return 0;
  if (installments <= 6) return 0.0199;
  return 0.0249;
}

/**
 * Calcula o total com taxa de parcelamento (tabela Price / juros compostos).
 * Retorna valores em centavos.
 */
export function computeCharge(
  amountCents: number,
  method: PaymentMethod,
  installments: number,
): { totalCents: number; feeCents: number; installmentCents: number } {
  const n = method === "credit" ? Math.max(1, Math.min(12, installments)) : 1;
  const i = method === "credit" ? monthlyRate(n) : 0;
  if (i === 0) {
    return {
      totalCents: amountCents,
      feeCents: 0,
      installmentCents: Math.round(amountCents / n),
    };
  }
  const factor = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
  const installmentCents = Math.round(amountCents * factor);
  const totalCents = installmentCents * n;
  return { totalCents, feeCents: totalCents - amountCents, installmentCents };
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  debit: "Cartão de débito",
  credit: "Cartão de crédito",
};

/* ---------- Pix "copia e cola" (BR Code estático) ---------- */

function emv(id: string, value: string): string {
  return id + String(value.length).padStart(2, "0") + value;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function sanitize(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .slice(0, max)
    .trim();
}

export function buildPixPayload(params: {
  key: string;
  holder: string;
  city?: string;
  amountCents: number;
  txid?: string;
}): string {
  const merchant =
    emv("00", "br.gov.bcb.pix") + emv("01", params.key.trim());
  const amount = (params.amountCents / 100).toFixed(2);
  const txid = sanitize(params.txid ?? "PRESENTE", 25) || "PRESENTE";
  const payload =
    emv("00", "01") +
    emv("26", merchant) +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", amount) +
    emv("58", "BR") +
    emv("59", sanitize(params.holder || "NOIVOS", 25) || "NOIVOS") +
    emv("60", sanitize(params.city ?? "SAO PAULO", 15) || "SAO PAULO") +
    emv("62", emv("05", txid)) +
    "6304";
  return payload + crc16(payload);
}

export function luhn(cardNumber: string): boolean {
  const digits = onlyDigits(cardNumber);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function cardBrand(cardNumber: string): string {
  const d = onlyDigits(cardNumber);
  if (/^4/.test(d)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "Mastercard";
  if (/^3[47]/.test(d)) return "American Express";
  if (/^(38|60|6505|6516)/.test(d)) return "Elo/Hipercard";
  return "Cartão";
}
