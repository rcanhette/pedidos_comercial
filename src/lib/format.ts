import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
export { formatMoneyCents, formatQuantityScaled, formatRateScaled } from "./scalars";

export function formatDateBr(value: Date | string | null | undefined) {
  if (!value) return "-";
  return format(new Date(value), "dd/MM/yyyy", { locale: ptBR });
}

export function formatMonthYearBr(value: Date | string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${month}/${date.getUTCFullYear()}`;
}

export function formatDateTimeBr(value: Date | string | null | undefined) {
  if (!value) return "-";
  return format(new Date(value), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

export function formatMoney(value: number | string, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(Number(value));
}

export function formatDecimalBr(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(Number(value));
}

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCnpj(value: string) {
  const digits = onlyDigits(value);
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
