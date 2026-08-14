import { z } from "zod";

const currentYear = new Date().getFullYear();

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

export const salesDashboardFiltersSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(currentYear),
  customerId: z.preprocess(emptyToUndefined, z.string().optional()),
  productId: z.preprocess(emptyToUndefined, z.string().optional()),
  contractTypeId: z.preprocess(emptyToUndefined, z.string().optional()),
  rawMaterialClosingId: z.preprocess(emptyToUndefined, z.string().optional()),
  representativeId: z.preprocess(emptyToUndefined, z.string().optional())
});


export const customerShareFiltersSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).default(new Date().getMonth() + 1),
  year: z.coerce.number().int().min(2000).max(2100).default(currentYear),
  productId: z.preprocess(emptyToUndefined, z.string().optional()),
  contractTypeId: z.preprocess(emptyToUndefined, z.string().optional()),
  rawMaterialClosingId: z.preprocess(emptyToUndefined, z.string().optional()),
  representativeId: z.preprocess(emptyToUndefined, z.string().optional())
});

export const salesTargetsSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  targets: z.array(z.object({
    month: z.coerce.number().int().min(1).max(12),
    targetTons: z.preprocess(emptyToUndefined, z.string().optional()),
    manualActualTons: z.preprocess(emptyToUndefined, z.string().optional())
  })).length(12)
});

export type SalesDashboardFiltersInput = z.infer<typeof salesDashboardFiltersSchema>;
export type SalesTargetsInput = z.infer<typeof salesTargetsSchema>;
export type CustomerShareFiltersInput = z.infer<typeof customerShareFiltersSchema>;
