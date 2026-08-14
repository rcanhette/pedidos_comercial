import { z } from "zod";
import { isValidCnpj, normalizeCnpj } from "@/utils/cnpj";

export function normalizeFreeText(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR");
}

export function freeTextSchema(min: number, max: number, message?: string) {
  return z.string().transform(normalizeFreeText).pipe(z.string().min(min, message).max(max));
}

export function optionalFreeTextSchema(max: number, min = 0, minMessage?: string) {
  return z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const normalized = normalizeFreeText(value);
      return normalized || undefined;
    })
    .refine((value) => value === undefined || value.length >= min, minMessage ?? `Informe pelo menos ${min} caracteres.`)
    .refine((value) => value === undefined || value.length <= max, `Informe no máximo ${max} caracteres.`);
}

export const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .regex(/[A-Z]/, "Inclua pelo menos uma letra maiúscula.")
  .regex(/[a-z]/, "Inclua pelo menos uma letra minúscula.")
  .regex(/[0-9]/, "Inclua pelo menos um número.")
  .regex(/[^A-Za-z0-9]/, "Inclua pelo menos um caractere especial.");

export const cnpjSchema = z
  .string()
  .transform(normalizeCnpj)
  .refine(isValidCnpj, "CNPJ inválido. Verifique os números informados.");

export const optionalCpfSchema = z
  .string()
  .optional()
  .transform((value) => (value ? value.replace(/\D/g, "") : undefined));

export const decimalInput = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).replace(/\./g, "").replace(",", "."))
  .pipe(z.coerce.number());

export const optionalDateInput = z
  .string()
  .optional()
  .transform((value) => (value ? new Date(`${value}T00:00:00`) : undefined));
