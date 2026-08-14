const moneyScale = 100;
const quantityScale = 1000;
const rateScale = 10000;

function normalizeDecimalInput(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return String(value);
  return value.trim().replace(/\./g, "").replace(",", ".");
}

function toScaled(value: number | string | null | undefined, scale: number) {
  const normalized = normalizeDecimalInput(value);
  if (normalized === undefined) return undefined;
  const number = Number(normalized);
  if (!Number.isFinite(number)) throw new Error("Valor numérico inválido.");
  return Math.round(number * scale);
}

export function moneyInputToCents(value: number | string | null | undefined) {
  return toScaled(value, moneyScale);
}

export function quantityInputToScaled(value: number | string | null | undefined) {
  return toScaled(value, quantityScale);
}

export function rateInputToScaled(value: number | string | null | undefined) {
  return toScaled(value, rateScale);
}

export function scaledToDecimal(value: number | null | undefined, scale: number) {
  if (value === null || value === undefined) return undefined;
  return value / scale;
}

export function centsToDecimal(value: number | null | undefined) {
  return scaledToDecimal(value, moneyScale);
}

export function quantityScaledToDecimal(value: number | null | undefined) {
  return scaledToDecimal(value, quantityScale);
}

export function rateScaledToDecimal(value: number | null | undefined) {
  return scaledToDecimal(value, rateScale);
}

export function formatMoneyCents(value: number | null | undefined, currency = "BRL") {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value / moneyScale);
}

export function formatQuantityScaled(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(value / quantityScale);
}

export function formatRateScaled(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(value / rateScale);
}


export function calculateTechnicalTonsScaled(quantityKgScaled: number, orderQuantityScaled: number) {
  return Math.round((quantityKgScaled * orderQuantityScaled) / 1_000_000);
}

export function formatQuantityScaledFixed(value: number | null | undefined, digits = 3) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value / quantityScale);
}
