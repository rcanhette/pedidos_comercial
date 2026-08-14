import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { formatMoneyCents } from "./scalars";
import { getCreatedRange, getPickupRange, type TechnicalListReportFiltersInput, type TechnicalListReportQueryInput } from "@/validations/technical-list-report";

export type TechnicalListReportUserScope = { id: string; fullName: string; permissions: string[] };

export function buildTechnicalListReportWhere(filters: TechnicalListReportFiltersInput, user: TechnicalListReportUserScope): Prisma.OrderRawMaterialWhereInput {
  if (!user.permissions.includes("RELATORIO_VISUALIZAR")) throw new Error("Você não possui permissão para executar esta ação.");
  const order: Prisma.OrderWhereInput = {};
  if (user.permissions.includes("PEDIDO_VISUALIZAR_TODOS")) {
    // Full scope.
  } else if (user.permissions.includes("PEDIDO_VISUALIZAR_PROPRIOS")) {
    order.createdById = user.id;
  } else {
    throw new Error("Você não possui permissão para visualizar pedidos neste relatório.");
  }
  if (filters.pedidoSap) order.sapOrderNumber = { contains: filters.pedidoSap, mode: "insensitive" };
  const createdRange = getCreatedRange(filters);
  if (createdRange.from || createdRange.toExclusive) order.solicitationAt = { ...(createdRange.from ? { gte: createdRange.from } : {}), ...(createdRange.toExclusive ? { lt: createdRange.toExclusive } : {}) };
  const pickupRange = getPickupRange(filters);
  if (pickupRange.from || pickupRange.toExclusive) order.pickupForecast = { ...(pickupRange.from ? { gte: pickupRange.from } : {}), ...(pickupRange.toExclusive ? { lt: pickupRange.toExclusive } : {}) };
  return { ...(filters.rawMaterialId ? { rawMaterialId: filters.rawMaterialId } : {}), order };
}

export function buildTechnicalListReportOrderBy(query: Pick<TechnicalListReportQueryInput, "sort" | "direction">): Prisma.OrderRawMaterialOrderByWithRelationInput[] {
  if (query.sort === "sapOrderNumber") return [{ order: { sapOrderNumber: query.direction } }, { rawMaterialNameSnapshot: "asc" }];
  if (query.sort === "solicitationAt") return [{ order: { solicitationAt: query.direction } }, { order: { sapOrderNumber: "asc" } }, { rawMaterialNameSnapshot: "asc" }];
  if (query.sort === "pickupForecast") return [{ order: { pickupForecast: query.direction } }, { order: { sapOrderNumber: "asc" } }, { rawMaterialNameSnapshot: "asc" }];
  return [{ rawMaterialNameSnapshot: query.direction }, { order: { solicitationAt: "desc" } }];
}

export function technicalListReportText(value: string | null | undefined) {
  return value?.trim() || "Não informado";
}

export function technicalListReportRepresentative(item: { order: { representativeName?: string | null; createdBy?: { fullName: string } | null } }) {
  return item.order.representativeName?.trim() || item.order.createdBy?.fullName?.trim() || "Não informado";
}

export function technicalListReportCommission(item: { order: { commissionUsdCents?: number | null } }) {
  return formatMoneyCents(item.order.commissionUsdCents, "USD");
}

export function buildTechnicalListReportFilterSummary(filters: TechnicalListReportFiltersInput, labels?: { rawMaterial?: string }) {
  const rows = [
    filters.pedidoSap ? `Pedido SAP: ${filters.pedidoSap}` : null,
    filters.createdFrom || filters.createdTo ? `Data de Criação: ${formatInputDate(filters.createdFrom) ?? "início"} até ${formatInputDate(filters.createdTo) ?? "fim"}` : null,
    filters.pickupFrom || filters.pickupTo ? `Previsão de Retirada: ${formatInputMonth(filters.pickupFrom) ?? "início"} até ${formatInputMonth(filters.pickupTo) ?? "fim"}` : null,
    filters.rawMaterialId ? `Matéria-prima: ${labels?.rawMaterial ?? filters.rawMaterialId}` : null
  ].filter(Boolean) as string[];
  return rows.length > 0 ? rows : ["Todos os itens permitidos"];
}

function formatInputDate(value: string | undefined) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatInputMonth(value: string | undefined) {
  if (!value) return undefined;
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

export function technicalListReportFilename(extension: "xlsx" | "pdf", date = new Date()) {
  return `relatorio-lista-tecnica-${format(date, "yyyy-MM-dd-HHmmss")}.${extension}`;
}
