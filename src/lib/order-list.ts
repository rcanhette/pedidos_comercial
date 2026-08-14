import { Prisma } from "@prisma/client";
import { activeOrderStatusOptions, orderStatusLabels } from "./constants";
import { getOrdersCreatedRange, getOrdersPickupRange, type OrdersListQueryInput } from "@/validations/order-list";

export type OrdersListScope = "own" | "all";

export type OrdersListUserScope = {
  id: string;
  permissions: string[];
};

export function ordersListScopeForUser(user: OrdersListUserScope): OrdersListScope {
  if (user.permissions.includes("PEDIDO_VISUALIZAR_TODOS")) return "all";
  if (user.permissions.includes("PEDIDO_VISUALIZAR_PROPRIOS")) return "own";
  throw new Error("Você não possui permissão para visualizar pedidos.");
}

export function ordersListPathForScope(scope: OrdersListScope) {
  return scope === "all" ? "/orders/all" : "/orders/my";
}

export function buildOrdersListWhere(filters: OrdersListQueryInput, user: OrdersListUserScope, scope: OrdersListScope): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  if (scope === "all") {
    if (!user.permissions.includes("PEDIDO_VISUALIZAR_TODOS")) throw new Error("Você não possui permissão para visualizar todos os pedidos.");
  } else {
    if (!user.permissions.includes("PEDIDO_VISUALIZAR_PROPRIOS")) throw new Error("Você não possui permissão para visualizar seus pedidos.");
    where.createdById = user.id;
  }

  if (filters.status) where.status = filters.status;
  if (filters.pedidoSap) where.sapOrderNumber = { contains: filters.pedidoSap, mode: "insensitive" };
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.productId) where.productId = filters.productId;
  if (filters.contractTypeId) where.contractTypeId = filters.contractTypeId;
  if (filters.rawMaterialClosingId) where.rawMaterialClosingId = filters.rawMaterialClosingId;
  if (scope === "all" && filters.representativeId) where.createdById = filters.representativeId;

  const createdRange = getOrdersCreatedRange(filters);
  if (createdRange.from || createdRange.toExclusive) {
    where.solicitationAt = {
      ...(createdRange.from ? { gte: createdRange.from } : {}),
      ...(createdRange.toExclusive ? { lt: createdRange.toExclusive } : {})
    };
  }

  const pickupRange = getOrdersPickupRange(filters);
  if (pickupRange.from || pickupRange.toExclusive) {
    where.pickupForecast = {
      ...(pickupRange.from ? { gte: pickupRange.from } : {}),
      ...(pickupRange.toExclusive ? { lt: pickupRange.toExclusive } : {})
    };
  }

  return where;
}

export function buildDashboardCountsWhere(user: OrdersListUserScope): Prisma.OrderWhereInput {
  return buildOrdersListWhere({ page: 1 }, user, ordersListScopeForUser(user));
}

export function normalizeDashboardStatusCounts(counts: Array<{ status: string; count: number }>) {
  const byStatus = Object.fromEntries(counts.map((item) => [item.status, item.count]));
  return Object.fromEntries(activeOrderStatusOptions.map((status) => [status, byStatus[status] ?? 0])) as Record<(typeof activeOrderStatusOptions)[number], number>;
}

export function ordersListStatusLabel(status: string) {
  return orderStatusLabels[status as keyof typeof orderStatusLabels] ?? status;
}
