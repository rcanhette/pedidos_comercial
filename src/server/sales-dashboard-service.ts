import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { assertPermission, getRequestMeta, type CurrentUser } from "./auth";
import { auditLog } from "./audit";
import { calculateCustomerShare, calculateSalesDashboard, optionalActualInputToScaled, orderQuantityToTonsScaled, salesDashboardRealizedStatuses, targetInputToScaled } from "@/lib/sales-dashboard";
import { customerShareFiltersSchema, salesDashboardFiltersSchema, salesTargetsSchema, type CustomerShareFiltersInput, type SalesDashboardFiltersInput, type SalesTargetsInput } from "@/validations/sales-dashboard";

function parseInput(input: URLSearchParams | Record<string, string | string[] | undefined>) {
  if (input instanceof URLSearchParams) return Object.fromEntries(input.entries());
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

export function parseSalesDashboardFilters(input: URLSearchParams | Record<string, string | string[] | undefined>) {
  return salesDashboardFiltersSchema.parse(parseInput(input));
}

export function parseCustomerShareFilters(input: URLSearchParams | Record<string, string | string[] | undefined>) {
  return customerShareFiltersSchema.parse(parseInput(input));
}

function canViewAll(user: CurrentUser) {
  return user.permissions.includes("PEDIDO_VISUALIZAR_TODOS");
}

function buildWhere(filters: SalesDashboardFiltersInput, user: CurrentUser): Prisma.OrderWhereInput {
  assertPermission(user, "RELATORIO_VISUALIZAR");
  const from = new Date(Date.UTC(filters.year, 0, 1));
  const to = new Date(Date.UTC(filters.year + 1, 0, 1));
  const where: Prisma.OrderWhereInput = {
    status: { in: [...salesDashboardRealizedStatuses] },
    pickupForecast: { gte: from, lt: to }
  };

  if (canViewAll(user)) {
    if (filters.representativeId) where.createdById = filters.representativeId;
  } else if (user.permissions.includes("PEDIDO_VISUALIZAR_PROPRIOS")) {
    where.createdById = user.id;
  } else {
    throw new Error("Você não possui permissão para visualizar os dados do painel.");
  }

  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.productId) where.productId = filters.productId;
  if (filters.contractTypeId) where.contractTypeId = filters.contractTypeId;
  if (filters.rawMaterialClosingId) where.rawMaterialClosingId = filters.rawMaterialClosingId;
  return where;
}

function hasDimensionalFilters(filters: SalesDashboardFiltersInput) {
  return Boolean(filters.customerId || filters.productId || filters.contractTypeId || filters.rawMaterialClosingId || filters.representativeId);
}

async function getFilterLabels(filters: SalesDashboardFiltersInput) {
  const [customer, product, contractType, rawMaterialClosing, representative] = await Promise.all([
    filters.customerId ? prisma.customer.findUnique({ where: { id: filters.customerId }, select: { name: true, city: true } }) : null,
    filters.productId ? prisma.product.findUnique({ where: { id: filters.productId }, select: { name: true } }) : null,
    filters.contractTypeId ? prisma.contractType.findUnique({ where: { id: filters.contractTypeId }, select: { name: true } }) : null,
    filters.rawMaterialClosingId ? prisma.rawMaterialClosing.findUnique({ where: { id: filters.rawMaterialClosingId }, select: { name: true } }) : null,
    filters.representativeId ? prisma.user.findUnique({ where: { id: filters.representativeId }, select: { fullName: true } }) : null
  ]);
  return {
    customer: customer ? `${customer.name} - ${customer.city}` : undefined,
    product: product?.name,
    contractType: contractType?.name,
    rawMaterialClosing: rawMaterialClosing?.name,
    representative: representative?.fullName
  };
}

export function buildSalesDashboardFilterSummary(filters: SalesDashboardFiltersInput, labels?: Awaited<ReturnType<typeof getFilterLabels>>) {
  const rows = [
    `Ano: ${filters.year}`,
    filters.customerId ? `Cliente: ${labels?.customer ?? filters.customerId}` : null,
    filters.productId ? `Produto: ${labels?.product ?? filters.productId}` : null,
    filters.contractTypeId ? `Tipo de Contrato: ${labels?.contractType ?? filters.contractTypeId}` : null,
    filters.rawMaterialClosingId ? `Tipo de MP: ${labels?.rawMaterialClosing ?? filters.rawMaterialClosingId}` : null,
    filters.representativeId ? `Representante: ${labels?.representative ?? filters.representativeId}` : null
  ].filter(Boolean) as string[];
  return rows;
}

export async function getSalesDashboardOptions(user: CurrentUser) {
  assertPermission(user, "RELATORIO_VISUALIZAR");
  const [customers, products, contractTypes, rawMaterialClosings, representatives] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, city: true, active: true }, orderBy: [{ name: "asc" }, { city: "asc" }] }),
    prisma.product.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    prisma.contractType.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    prisma.rawMaterialClosing.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    canViewAll(user)
      ? prisma.user.findMany({ where: { createdOrders: { some: {} } }, select: { id: true, fullName: true, active: true }, orderBy: { fullName: "asc" } })
      : Promise.resolve([])
  ]);
  return { customers, products, contractTypes, rawMaterialClosings, representatives };
}

export async function getSalesPerformanceDashboard(user: CurrentUser, filters: SalesDashboardFiltersInput) {
  const where = buildWhere(filters, user);
  const [targets, orders, labels] = await Promise.all([
    prisma.salesTarget.findMany({ where: { year: filters.year }, select: { month: true, targetTonsScaled: true, manualActualTonsScaled: true }, orderBy: { month: "asc" } }),
    prisma.order.findMany({
      where,
      select: { id: true, pickupForecast: true, quantityScaled: true, productUnitSnapshot: true }
    }),
    getFilterLabels(filters)
  ]);

  const targetsScaled = Array(12).fill(0) as number[];
  const manualActualScaled = Array(12).fill(null) as Array<number | null>;
  for (const target of targets) targetsScaled[target.month - 1] = target.targetTonsScaled;
  const canUseManualActual = canViewAll(user) && !hasDimensionalFilters(filters);
  if (canUseManualActual) for (const target of targets) manualActualScaled[target.month - 1] = target.manualActualTonsScaled;

  const realizedScaled = Array(12).fill(0) as number[];
  let ignoredIncompatibleOrders = 0;
  for (const order of orders) {
    if (!order.pickupForecast) continue;
    const tonsScaled = orderQuantityToTonsScaled(order.quantityScaled, order.productUnitSnapshot);
    if (tonsScaled === null) {
      ignoredIncompatibleOrders += 1;
      continue;
    }
    realizedScaled[order.pickupForecast.getUTCMonth()] += tonsScaled;
  }

  const calculated = calculateSalesDashboard({
    year: filters.year,
    targetsScaled,
    realizedScaled,
    manualActualScaled: canUseManualActual ? manualActualScaled : undefined,
    ignoredIncompatibleOrders
  });

  await auditLog({
    action: "SALES_DASHBOARD_VIEWED",
    entity: "SalesDashboard",
    userId: user.id,
    afterData: { filters, orders: orders.length, ignoredIncompatibleOrders },
    ...(await getRequestMeta())
  });

  return {
    filters,
    filterSummary: buildSalesDashboardFilterSummary(filters, labels),
    canManageTargets: user.permissions.includes("META_VENDAS_GERENCIAR"),
    usesManualActuals: canUseManualActual,
    realizedStatuses: [...salesDashboardRealizedStatuses],
    ...calculated
  };
}

function buildCustomerShareWhere(filters: CustomerShareFiltersInput, user: CurrentUser): Prisma.OrderWhereInput {
  assertPermission(user, "RELATORIO_VISUALIZAR");
  const from = new Date(Date.UTC(filters.year, filters.month - 1, 1));
  const to = new Date(Date.UTC(filters.month === 12 ? filters.year + 1 : filters.year, filters.month === 12 ? 0 : filters.month, 1));
  const where: Prisma.OrderWhereInput = {
    status: { in: [...salesDashboardRealizedStatuses] },
    pickupForecast: { gte: from, lt: to }
  };

  if (canViewAll(user)) {
    if (filters.representativeId) where.createdById = filters.representativeId;
  } else if (user.permissions.includes("PEDIDO_VISUALIZAR_PROPRIOS")) {
    where.createdById = user.id;
  } else {
    throw new Error("Você não possui permissão para visualizar os dados do painel.");
  }

  if (filters.productId) where.productId = filters.productId;
  if (filters.contractTypeId) where.contractTypeId = filters.contractTypeId;
  if (filters.rawMaterialClosingId) where.rawMaterialClosingId = filters.rawMaterialClosingId;
  return where;
}

export function buildCustomerShareFilterSummary(filters: CustomerShareFiltersInput, labels?: Awaited<ReturnType<typeof getFilterLabels>>) {
  const rows = [
    `Mês: ${String(filters.month).padStart(2, "0")}/${filters.year}`,
    filters.productId ? `Produto: ${labels?.product ?? filters.productId}` : null,
    filters.contractTypeId ? `Tipo de Contrato: ${labels?.contractType ?? filters.contractTypeId}` : null,
    filters.rawMaterialClosingId ? `Tipo de MP: ${labels?.rawMaterialClosing ?? filters.rawMaterialClosingId}` : null,
    filters.representativeId ? `Representante: ${labels?.representative ?? filters.representativeId}` : null
  ].filter(Boolean) as string[];
  return rows;
}

export async function getCustomerSalesShare(user: CurrentUser, filters: CustomerShareFiltersInput) {
  const where = buildCustomerShareWhere(filters, user);
  const [orders, labels] = await Promise.all([
    prisma.order.findMany({
      where,
      select: { id: true, customerId: true, customerName: true, quantityScaled: true, productUnitSnapshot: true }
    }),
    getFilterLabels({ year: filters.year, productId: filters.productId, contractTypeId: filters.contractTypeId, rawMaterialClosingId: filters.rawMaterialClosingId, representativeId: filters.representativeId })
  ]);
  let ignoredIncompatibleOrders = 0;
  const rows = orders.flatMap((order) => {
    const tonsScaled = orderQuantityToTonsScaled(order.quantityScaled, order.productUnitSnapshot);
    if (tonsScaled === null) {
      ignoredIncompatibleOrders += 1;
      return [];
    }
    return [{ customerId: order.customerId, customerName: order.customerName, tonsScaled, orderId: order.id }];
  });
  const calculated = calculateCustomerShare(rows);
  await auditLog({
    action: "CUSTOMER_SHARE_DASHBOARD_VIEWED",
    entity: "SalesDashboard",
    userId: user.id,
    afterData: { filters, orders: orders.length, ignoredIncompatibleOrders },
    ...(await getRequestMeta())
  });
  return {
    filters,
    filterSummary: buildCustomerShareFilterSummary(filters, labels),
    ignoredIncompatibleOrders,
    ...calculated
  };
}

export async function getSalesTargetsForYear(user: CurrentUser, year: number) {
  assertPermission(user, "META_VENDAS_GERENCIAR");
  const targets = await prisma.salesTarget.findMany({ where: { year }, orderBy: { month: "asc" } });
  const byMonth = new Map(targets.map((target) => [target.month, target]));
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const target = byMonth.get(month);
    return { month, targetTonsScaled: target?.targetTonsScaled ?? 0, manualActualTonsScaled: target?.manualActualTonsScaled ?? null };
  });
}

export async function saveSalesTargets(user: CurrentUser, input: SalesTargetsInput) {
  assertPermission(user, "META_VENDAS_GERENCIAR");
  const parsed = salesTargetsSchema.parse(input);
  const meta = await getRequestMeta();

  return prisma.$transaction(async (tx) => {
    const before = await tx.salesTarget.findMany({ where: { year: parsed.year }, orderBy: { month: "asc" } });
    const beforeByMonth = new Map(before.map((target) => [target.month, target]));
    const changes: Array<{ month: number; targetBefore: number; targetAfter: number; manualActualBefore: number | null; manualActualAfter: number | null }> = [];

    for (const item of parsed.targets) {
      const targetTonsScaled = targetInputToScaled(item.targetTons);
      const manualActualTonsScaled = optionalActualInputToScaled(item.manualActualTons);
      const previous = beforeByMonth.get(item.month);
      const previousTarget = previous?.targetTonsScaled ?? 0;
      const previousManualActual = previous?.manualActualTonsScaled ?? null;
      if (previousTarget !== targetTonsScaled || previousManualActual !== manualActualTonsScaled) {
        changes.push({ month: item.month, targetBefore: previousTarget, targetAfter: targetTonsScaled, manualActualBefore: previousManualActual, manualActualAfter: manualActualTonsScaled });
      }
      await tx.salesTarget.upsert({
        where: { year_month: { year: parsed.year, month: item.month } },
        update: { targetTonsScaled, manualActualTonsScaled, updatedById: user.id },
        create: { year: parsed.year, month: item.month, targetTonsScaled, manualActualTonsScaled, updatedById: user.id }
      });
    }

    if (changes.length > 0) {
      await tx.auditLog.create({
        data: {
          action: before.length > 0 ? "SALES_TARGET_UPDATED" : "SALES_TARGET_CREATED",
          entity: "SalesTarget",
          userId: user.id,
          beforeData: JSON.stringify({ year: parsed.year, targets: before.map((item) => ({ month: item.month, targetTonsScaled: item.targetTonsScaled, manualActualTonsScaled: item.manualActualTonsScaled })) }),
          afterData: JSON.stringify({ year: parsed.year, changes }),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent
        }
      });
    }

    return { changes: changes.length };
  });
}
