import { z } from "zod";

export const salesReportPageSize = 20;

const sortFields = ["sapOrderNumber", "solicitationAt", "customerName", "productNameSnapshot", "pickupForecast", "status"] as const;
const sortDirections = ["asc", "desc"] as const;
const reportStatuses = ["RECEBIDO", "APROVADO", "EM_CRIACAO", "PEDIDO_CRIADO", "ENVIADO_PARA_ASSINATURA", "CANCELADO"] as const;

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function parseDateOnly(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} inválida.`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${field} inválida.`);
  }
  return date;
}

function parseMonth(value: string, field: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error(`${field} inválida.`);
  const [year, month] = value.split("-").map(Number);
  if (month < 1 || month > 12) throw new Error(`${field} inválida.`);
  return new Date(Date.UTC(year, month - 1, 1));
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addUtcMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

const salesReportFiltersBaseSchema = z.object({
  pedidoSap: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  customerId: z.preprocess(emptyToUndefined, z.string().optional()),
  productId: z.preprocess(emptyToUndefined, z.string().optional()),
  contractTypeId: z.preprocess(emptyToUndefined, z.string().optional()),
  rawMaterialClosingId: z.preprocess(emptyToUndefined, z.string().optional()),
  status: z.preprocess(emptyToUndefined, z.enum(reportStatuses).optional()),
  createdFrom: z.preprocess(emptyToUndefined, z.string().optional()),
  createdTo: z.preprocess(emptyToUndefined, z.string().optional()),
  pickupForecast: z.preprocess(emptyToUndefined, z.string().optional())
});

function validateRanges(data: z.infer<typeof salesReportFiltersBaseSchema>, ctx: z.RefinementCtx) {
  try {
    const createdFrom = data.createdFrom ? parseDateOnly(data.createdFrom, "Data de criação inicial") : undefined;
    const createdTo = data.createdTo ? parseDateOnly(data.createdTo, "Data de criação final") : undefined;
    if (createdFrom && createdTo && createdFrom > createdTo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["createdFrom"], message: "A data de criação inicial não pode ser posterior à final." });
    }
  } catch (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : "Período inválido." });
  }

  if (data.pickupForecast) {
    try {
      parseMonth(data.pickupForecast, "Previsão de retirada");
    } catch (error) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pickupForecast"], message: error instanceof Error ? error.message : "Previsão de retirada inválida." });
    }
  }
}

export const salesReportFiltersSchema = salesReportFiltersBaseSchema.superRefine(validateRanges);

export const salesReportQuerySchema = salesReportFiltersBaseSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  sort: z.enum(sortFields).default("solicitationAt"),
  direction: z.enum(sortDirections).default("desc")
}).superRefine(validateRanges);

export type SalesReportFiltersInput = z.infer<typeof salesReportFiltersSchema>;
export type SalesReportQueryInput = z.infer<typeof salesReportQuerySchema>;
export type SalesReportSortField = (typeof sortFields)[number];
export type SalesReportSortDirection = (typeof sortDirections)[number];

export function getCreatedRange(filters: SalesReportFiltersInput) {
  return {
    from: filters.createdFrom ? parseDateOnly(filters.createdFrom, "Data de criação inicial") : undefined,
    toExclusive: filters.createdTo ? addUtcDays(parseDateOnly(filters.createdTo, "Data de criação final"), 1) : undefined
  };
}

export function getPickupRange(filters: SalesReportFiltersInput) {
  const month = filters.pickupForecast ? parseMonth(filters.pickupForecast, "Previsão de retirada") : undefined;
  return {
    from: month,
    toExclusive: month ? addUtcMonths(month, 1) : undefined
  };
}
