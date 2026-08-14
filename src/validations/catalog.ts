import { z } from "zod";
import { cnpjSchema, decimalInput, freeTextSchema, optionalFreeTextSchema } from "./common";

export const productSchema = z.object({
  name: freeTextSchema(2, 150),
  description: optionalFreeTextSchema(500),
  unit: freeTextSchema(1, 30),
  active: z.coerce.boolean().default(true)
});

export const packageSchema = z.object({
  name: freeTextSchema(2, 150),
  description: optionalFreeTextSchema(500),
  capacity: decimalInput.optional(),
  unit: optionalFreeTextSchema(30),
  weight: decimalInput.optional(),
  active: z.coerce.boolean().default(true)
});

export const currencySchema = z.object({
  name: freeTextSchema(2, 100),
  code: z.string().length(3).transform((value) => value.toUpperCase()),
  symbol: freeTextSchema(1, 10),
  decimalPlaces: z.coerce.number().int().min(0).max(6),
  active: z.coerce.boolean().default(true)
});


export const customerSchema = z.object({
  name: freeTextSchema(2, 150, "Informe pelo menos 2 caracteres."),
  city: freeTextSchema(1, 100, "Informe a cidade."),
  cnpj: cnpjSchema,
  active: z.coerce.boolean().default(true)
});


export const simpleCatalogSchema = z.object({
  name: freeTextSchema(2, 150, "Informe pelo menos 2 caracteres."),
  active: z.coerce.boolean().default(true)
});
