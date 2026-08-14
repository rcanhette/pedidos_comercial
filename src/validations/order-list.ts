import { z } from "zod";

export const ordersListPageSize = 20;

const orderListStatuses = ["RECEBIDO", "APROVADO", "EM_CRIACAO", "PEDIDO_CRIADO", "ENVIADO_PARA_ASSINATURA", "CANCELADO"] as const;

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function parseDateOnly(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} inválida.`);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`${field} inválida.`);
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

const ordersListBaseSchema = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(orderListStatuses).optional()),
  pedidoSap: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  createdFrom: z.preprocess(emptyToUndefined, z.string().optional()),
  createdTo: z.preprocess(emptyToUndefined, z.string().optional()),
  pickupFrom: z.preprocess(emptyToUndefined, z.string().optional()),
  pickupTo: z.preprocess(emptyToUndefined, z.string().optional()),
  customerId: z.preprocess(emptyToUndefined, z.string().optional()),
  productId: z.preprocess(emptyToUndefined, z.string().optional()),
  contractTypeId: z.preprocess(emptyToUndefined, z.string().optional()),
  rawMaterialClosingId: z.preprocess(emptyToUndefined, z.string().optional()),
  representativeId: z.preprocess(emptyToUndefined, z.string().optional())
});

function validateRanges(data: z.infer<typeof ordersListBaseSchema>, ctx: z.RefinementCtx) {
  try {
    const createdFrom = data.createdFrom ? parseDateOnly(data.createdFrom, "Data de criação inicial") : undefined;
    const createdTo = data.createdTo ? parseDateOnly(data.createdTo, "Data de criação final") : undefined;
    if (createdFrom && createdTo && createdFrom > createdTo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["createdFrom"], message: "A data de criação inicial não pode ser posterior à final." });
  } catch (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : "Período inválido." });
  }

  try {
    const pickupFrom = data.pickupFrom ? parseMonth(data.pickupFrom, "Previsão inicial") : undefined;
    const pickupTo = data.pickupTo ? parseMonth(data.pickupTo, "Previsão final") : undefined;
    if (pickupFrom && pickupTo && pickupFrom > pickupTo) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pickupFrom"], message: "A previsão inicial não pode ser posterior à final." });
  } catch (error) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: error instanceof Error ? error.message : "Previsão inválida." });
  }
}

export const ordersListQuerySchema = ordersListBaseSchema.extend({
  page: z.coerce.number().int().min(1).default(1)
}).superRefine(validateRanges);

export type OrdersListQueryInput = z.infer<typeof ordersListQuerySchema>;
export type OrdersListStatus = (typeof orderListStatuses)[number];

export function getOrdersCreatedRange(filters: OrdersListQueryInput) {
  return {
    from: filters.createdFrom ? parseDateOnly(filters.createdFrom, "Data de criação inicial") : undefined,
    toExclusive: filters.createdTo ? addUtcDays(parseDateOnly(filters.createdTo, "Data de criação final"), 1) : undefined
  };
}

export function getOrdersPickupRange(filters: OrdersListQueryInput) {
  const from = filters.pickupFrom ? parseMonth(filters.pickupFrom, "Previsão inicial") : undefined;
  const to = filters.pickupTo ? parseMonth(filters.pickupTo, "Previsão final") : undefined;
  return { from, toExclusive: to ? addUtcMonths(to, 1) : undefined };
}
