import { Prisma } from "@prisma/client";
import { format } from "date-fns";
import { orderStatusLabels } from "./constants";
import { getCreatedRange, getPickupRange, type SalesReportFiltersInput, type SalesReportQueryInput } from "@/validations/sales-report";

export type SalesReportUserScope = {
  id: string;
  fullName: string;
  permissions: string[];
};

export function buildSalesReportWhere(filters: SalesReportFiltersInput, user: SalesReportUserScope): Prisma.OrderWhereInput {
  if (!user.permissions.includes("RELATORIO_VISUALIZAR")) {
    throw new Error("Você não possui permissão para executar esta ação.");
  }

  const where: Prisma.OrderWhereInput = {};

  if (user.permissions.includes("PEDIDO_VISUALIZAR_TODOS")) {
    // Full report scope.
  } else if (user.permissions.includes("PEDIDO_VISUALIZAR_PROPRIOS")) {
    where.createdById = user.id;
  } else {
    throw new Error("Você não possui permissão para visualizar pedidos neste relatório.");
  }

  if (filters.pedidoSap) where.sapOrderNumber = { contains: filters.pedidoSap, mode: "insensitive" };
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.productId) where.productId = filters.productId;
  if (filters.contractTypeId) where.contractTypeId = filters.contractTypeId;
  if (filters.rawMaterialClosingId) where.rawMaterialClosingId = filters.rawMaterialClosingId;
  if (filters.status) where.status = filters.status;

  const createdRange = getCreatedRange(filters);
  if (createdRange.from || createdRange.toExclusive) {
    where.solicitationAt = {
      ...(createdRange.from ? { gte: createdRange.from } : {}),
      ...(createdRange.toExclusive ? { lt: createdRange.toExclusive } : {})
    };
  }

  const pickupRange = getPickupRange(filters);
  if (pickupRange.from || pickupRange.toExclusive) {
    where.pickupForecast = {
      ...(pickupRange.from ? { gte: pickupRange.from } : {}),
      ...(pickupRange.toExclusive ? { lt: pickupRange.toExclusive } : {})
    };
  }

  return where;
}

export function buildSalesReportOrderBy(query: Pick<SalesReportQueryInput, "sort" | "direction">): Prisma.OrderOrderByWithRelationInput {
  return { [query.sort]: query.direction };
}

export function salesReportStatusLabel(status: string) {
  return orderStatusLabels[status as keyof typeof orderStatusLabels] ?? status;
}

export function salesReportText(value: string | null | undefined) {
  return value?.trim() || "Não informado";
}

export function buildSalesReportFilterSummary(filters: SalesReportFiltersInput, labels?: {
  customer?: string;
  product?: string;
  contractType?: string;
  rawMaterialClosing?: string;
}) {
  const rows = [
    filters.pedidoSap ? `Pedido SAP: ${filters.pedidoSap}` : null,
    filters.customerId ? `Cliente: ${labels?.customer ?? filters.customerId}` : null,
    filters.productId ? `Produto: ${labels?.product ?? filters.productId}` : null,
    filters.contractTypeId ? `Tipo de Contrato: ${labels?.contractType ?? filters.contractTypeId}` : null,
    filters.rawMaterialClosingId ? `Tipo de MP: ${labels?.rawMaterialClosing ?? filters.rawMaterialClosingId}` : null,
    filters.status ? `Status: ${salesReportStatusLabel(filters.status)}` : null,
    filters.createdFrom || filters.createdTo ? `Data de Criação: ${formatInputDate(filters.createdFrom) ?? "início"} até ${formatInputDate(filters.createdTo) ?? "fim"}` : null,
    filters.pickupForecast ? `Previsão de Retirada: ${formatInputMonth(filters.pickupForecast)}` : null
  ].filter(Boolean) as string[];
  return rows.length > 0 ? rows : ["Todos os pedidos permitidos"];
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

export function salesReportFilename(extension: "xlsx" | "pdf", date = new Date()) {
  return `relatorio-vendas-${format(date, "yyyy-MM-dd-HHmmss")}.${extension}`;
}
