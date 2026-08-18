import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { assertPermission, type CurrentUser, getRequestMeta } from "./auth";
import { auditLog } from "./audit";
import { NEW_RECORD_VALUE, type OrderCreateInput, type OrderStatusInput, type TechnicalListUpdateInput } from "@/validations/order";
import { buildDashboardCountsWhere, buildOrdersListWhere, normalizeDashboardStatusCounts, type OrdersListScope } from "@/lib/order-list";
import { ordersListPageSize, ordersListQuerySchema, type OrdersListQueryInput } from "@/validations/order-list";
import { calculateTechnicalTonsScaled, moneyInputToCents, quantityInputToScaled, rateInputToScaled } from "@/lib/scalars";

export type OrderStatusValue = "RECEBIDO" | "APROVADO" | "EM_CRIACAO" | "PEDIDO_CRIADO" | "ENVIADO_PARA_ASSINATURA" | "CANCELADO" | "RECUSADO";

function canEditOrder(user: CurrentUser, order: { createdById: string; status: string }) {
  if (user.permissions.includes("PEDIDO_EDITAR_TODOS")) return order.status !== "CANCELADO";
  return user.permissions.includes("PEDIDO_EDITAR_PROPRIOS") && order.createdById === user.id && order.status === "RECEBIDO";
}

function canManageTechnicalList(user: CurrentUser) {
  return user.permissions.includes("MATERIA_PRIMA_VISUALIZAR") && !user.roles.includes("Representante Externo");
}

function stringifyChange(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function freightInputToCents(value: string | undefined) {
  if (!value) return undefined;
  try {
    return moneyInputToCents(value);
  } catch {
    return undefined;
  }
}

function freightInputToText(value: string | undefined) {
  const text = value?.trim();
  return text || undefined;
}

function rateInputToScaledOptional(value: string | undefined) {
  if (!value) return undefined;
  try {
    return rateInputToScaled(value);
  } catch {
    return undefined;
  }
}

function rateInputToText(value: string | undefined) {
  const text = value?.trim();
  return text || undefined;
}

async function resolveOrderCustomer(tx: Prisma.TransactionClient, input: OrderCreateInput) {
  if (input.customerId !== NEW_RECORD_VALUE) {
    const customer = await tx.customer.findFirst({ where: { id: input.customerId, active: true } });
    if (!customer) throw new Error("Cliente ativo não encontrado.");
    return customer;
  }

  const name = input.newCustomerName?.trim();
  const city = input.newCustomerCity?.trim();
  const cnpj = input.newCustomerCnpj;
  if (!name || !city || !cnpj) throw new Error("Informe os dados do novo cliente.");

  return tx.customer.upsert({
    where: { cnpj },
    update: { name, city, active: true },
    create: { name, city, cnpj, active: true }
  });
}

async function resolveOrderProduct(tx: Prisma.TransactionClient, input: OrderCreateInput) {
  if (input.productId !== NEW_RECORD_VALUE) {
    const product = await tx.product.findFirst({ where: { id: input.productId, active: true } });
    if (!product) throw new Error("Produto ativo não encontrado.");
    return product;
  }

  const name = input.newProductName?.trim();
  const unit = input.newProductUnit?.trim();
  const description = input.newProductDescription?.trim() || undefined;
  if (!name || !unit) throw new Error("Informe os dados do novo produto.");

  const existing = await tx.product.findFirst({ where: { name } });
  if (existing) return tx.product.update({ where: { id: existing.id }, data: { name, unit, description, active: true } });
  return tx.product.create({ data: { name, unit, description, active: true } });
}

async function resolveOrderAuxiliaries(tx: Prisma.TransactionClient, input: OrderCreateInput) {
  const [contractType, rawMaterialClosing, salesResponsible] = await Promise.all([
    tx.contractType.findFirst({ where: { id: input.contractTypeId, active: true } }),
    tx.rawMaterialClosing.findFirst({ where: { id: input.rawMaterialClosingId, active: true } }),
    resolveOrderSalesResponsible(tx, input)
  ]);
  if (!contractType) throw new Error("Tipo de contrato ativo não encontrado.");
  if (!rawMaterialClosing) throw new Error("Tipo de MP ativo não encontrado.");
  return { contractType, rawMaterialClosing, salesResponsible };
}

async function resolveOrderSalesResponsible(tx: Prisma.TransactionClient, input: OrderCreateInput) {
  if (!input.salesResponsibleId) return null;
  if (input.salesResponsibleId !== NEW_RECORD_VALUE) {
    const salesResponsible = await tx.salesResponsible.findFirst({ where: { id: input.salesResponsibleId, active: true } });
    if (!salesResponsible) throw new Error("Responsável pela venda ativo não encontrado.");
    return salesResponsible;
  }

  const name = input.newSalesResponsibleName?.trim();
  if (!name) throw new Error("Informe o responsável pela venda.");

  const existing = await tx.salesResponsible.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (existing) return tx.salesResponsible.update({ where: { id: existing.id }, data: { name, active: true } });
  return tx.salesResponsible.create({ data: { name, active: true } });
}

async function buildTechnicalItems(tx: Prisma.TransactionClient, input: OrderCreateInput, options: { requireItems: boolean }) {
  const orderQuantityScaled = quantityInputToScaled(input.quantity) ?? 0;
  if (orderQuantityScaled <= 0) throw new Error("A quantidade do pedido deve ser maior que zero.");
  if (options.requireItems && input.technicalItems.length === 0) throw new Error("Informe pelo menos uma matéria-prima.");
  if (!options.requireItems && input.technicalItems.length === 0) return [];
  const ids = input.technicalItems.map((item) => item.rawMaterialId);
  if (new Set(ids).size !== ids.length) throw new Error("Não repita a mesma matéria-prima no pedido.");
  const materials = await tx.rawMaterial.findMany({ where: { id: { in: ids }, active: true } });
  if (materials.length !== ids.length) throw new Error("Matéria-prima ativa não encontrada.");
  const byId = new Map(materials.map((item) => [item.id, item]));
  return input.technicalItems.map((item) => {
    const material = byId.get(item.rawMaterialId);
    if (!material) throw new Error("Matéria-prima ativa não encontrada.");
    const quantityKgScaled = quantityInputToScaled(item.quantityKg) ?? 0;
    const priceCents = moneyInputToCents(item.price);
    if (quantityKgScaled <= 0) throw new Error("A quantidade em KG deve ser maior que zero.");
    if (priceCents == null) throw new Error("Informe o preço.");
    if (priceCents < 0) throw new Error("O preço da matéria-prima não pode ser negativo.");
    return {
      rawMaterialId: material.id,
      rawMaterialNameSnapshot: material.name,
      quantityKgScaled,
      quantityTonsScaled: calculateTechnicalTonsScaled(quantityKgScaled, orderQuantityScaled),
      priceCents
    };
  });
}

async function assertTechnicalListCompleteForStatus(tx: Prisma.TransactionClient, orderId: string, message: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      quantityScaled: true,
      technicalClosingItems: { select: { rawMaterialId: true, quantityKgScaled: true, quantityTonsScaled: true, priceCents: true } }
    }
  });
  if (!order) throw new Error("Pedido não encontrado.");
  if (order.quantityScaled <= 0 || order.technicalClosingItems.length === 0) throw new Error(message);
  const ids = order.technicalClosingItems.map((item) => item.rawMaterialId);
  if (new Set(ids).size !== ids.length) throw new Error(message);
  for (const item of order.technicalClosingItems) {
    if (!item.rawMaterialId || item.quantityKgScaled <= 0 || item.priceCents === null || item.priceCents < 0) throw new Error(message);
    const expectedTons = calculateTechnicalTonsScaled(item.quantityKgScaled, order.quantityScaled);
    if (item.quantityTonsScaled !== expectedTons) throw new Error(message);
  }
}

export async function nextOrderNumber(tx: Prisma.TransactionClient, date = new Date()) {
  const year = date.getFullYear();
  const rows = await tx.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "OrderNumberSequence" ("year", "value")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "value" = "OrderNumberSequence"."value" + 1
    RETURNING "value"
  `;
  const value = rows[0]?.value;
  if (!value) throw new Error("Não foi possível gerar o número do pedido.");
  return `PED-${year}-${String(value).padStart(6, "0")}`;
}

export async function createOrder(user: CurrentUser, input: OrderCreateInput) {
  assertPermission(user, "PEDIDO_CRIAR");
  const userCanManageTechnicalList = canManageTechnicalList(user);
  if (!userCanManageTechnicalList && input.technicalItems.length > 0) {
    throw new Error("Seu perfil não possui permissão para cadastrar ou alterar a Lista Técnica.");
  }
  const meta = await getRequestMeta();
  return prisma.$transaction(async (tx) => {
    const [customer, product, pack, currency, auxiliaries, technicalItems] = await Promise.all([
      resolveOrderCustomer(tx, input),
      resolveOrderProduct(tx, input),
      tx.package.findFirst({ where: { id: input.packageId, active: true } }),
      tx.currency.findFirst({ where: { id: input.currencyId, active: true } }),
      resolveOrderAuxiliaries(tx, input),
      buildTechnicalItems(tx, input, { requireItems: userCanManageTechnicalList })
    ]);
    if (!pack) throw new Error("Embalagem ativa não encontrada.");
    if (!currency) throw new Error("Moeda ativa não encontrada.");

    const number = await nextOrderNumber(tx);
    const order = await tx.order.create({
      data: {
        number,
        representativeId: user.id,
        representativeName: user.fullName,
        createdById: user.id,
        customerId: customer.id,
        salesResponsibleId: auxiliaries.salesResponsible?.id,
        salesResponsibleNameSnapshot: auxiliaries.salesResponsible?.name,
        contractTypeId: auxiliaries.contractType.id,
        contractTypeNameSnapshot: auxiliaries.contractType.name,
        rawMaterialClosingId: auxiliaries.rawMaterialClosing.id,
        rawMaterialClosingNameSnapshot: auxiliaries.rawMaterialClosing.name,
        customerName: customer.name,
        city: customer.city,
        cnpj: customer.cnpj,
        productId: product.id,
        productNameSnapshot: product.name,
        productUnitSnapshot: product.unit,
        quantityScaled: quantityInputToScaled(input.quantity) ?? 0,
        packageId: pack.id,
        packageNameSnapshot: pack.name,
        currencyId: currency.id,
        currencyCodeSnapshot: currency.code,
        currencySymbolSnapshot: currency.symbol,
        unitPriceCents: moneyInputToCents(input.unitPrice) ?? 0,
        dollarRateScaled: rateInputToScaledOptional(input.dollarRate),
        dollarRateText: rateInputToText(input.dollarRate),
        paymentTerms: input.paymentTerms,
        commissionUsdCents: moneyInputToCents(input.commissionUsd),
        paymentDate: input.paymentDate,
        pickupForecast: input.pickupForecast,
        freightCents: freightInputToCents(input.freight),
        freightText: freightInputToText(input.freight),
        notes: input.notes,
        lastChangedById: user.id,
        ...(technicalItems.length > 0 ? { technicalClosingItems: { create: technicalItems } } : {}),
        statusHistory: {
          create: {
            newStatus: "RECEBIDO",
            changedById: user.id,
            justification: "Pedido recebido.",
            ipAddress: meta.ipAddress
          }
        }
      }
    });
    await tx.auditLog.create({
      data: {
        action: "ORDER_CREATED",
        entity: "Order",
        entityId: order.id,
        userId: user.id,
        afterData: JSON.stringify({ number: order.number }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });
    return order;
  });
}

export async function updateOrder(user: CurrentUser, orderId: string, input: OrderCreateInput, options: { updateTechnicalList?: boolean } = {}) {
  const meta = await getRequestMeta();
  return prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: orderId } });
    if (!current) throw new Error("Pedido não encontrado.");
    if (!canEditOrder(user, current)) throw new Error("Este pedido não pode mais ser editado porque já foi aprovado.");
    const userCanManageTechnicalList = canManageTechnicalList(user);
    if (options.updateTechnicalList && !userCanManageTechnicalList && input.technicalItems.length > 0) {
      throw new Error("Seu perfil não possui permissão para cadastrar ou alterar a Lista Técnica.");
    }

    const [customer, product, pack, currency, auxiliaries, technicalItems] = await Promise.all([
      resolveOrderCustomer(tx, input),
      resolveOrderProduct(tx, input),
      tx.package.findUnique({ where: { id: input.packageId } }),
      tx.currency.findUnique({ where: { id: input.currencyId } }),
      resolveOrderAuxiliaries(tx, input),
      options.updateTechnicalList && userCanManageTechnicalList ? buildTechnicalItems(tx, input, { requireItems: current.status !== "RECEBIDO" }) : Promise.resolve([])
    ]);
    if (!pack) throw new Error("Embalagem não encontrada.");
    if (!currency) throw new Error("Moeda não encontrada.");

    const nextData = {
      customerId: customer.id,
      salesResponsibleId: auxiliaries.salesResponsible?.id ?? null,
      salesResponsibleNameSnapshot: auxiliaries.salesResponsible?.name ?? null,
      contractTypeId: auxiliaries.contractType.id,
      contractTypeNameSnapshot: auxiliaries.contractType.name,
      rawMaterialClosingId: auxiliaries.rawMaterialClosing.id,
      rawMaterialClosingNameSnapshot: auxiliaries.rawMaterialClosing.name,
      customerName: customer.name,
      city: customer.city,
      cnpj: customer.cnpj,
      productId: product.id,
      productNameSnapshot: product.name,
      productUnitSnapshot: product.unit,
      quantityScaled: quantityInputToScaled(input.quantity) ?? 0,
      packageId: pack.id,
      packageNameSnapshot: pack.name,
      currencyId: currency.id,
      currencyCodeSnapshot: currency.code,
      currencySymbolSnapshot: currency.symbol,
      unitPriceCents: moneyInputToCents(input.unitPrice) ?? 0,
      dollarRateScaled: rateInputToScaledOptional(input.dollarRate),
      dollarRateText: rateInputToText(input.dollarRate),
      paymentTerms: input.paymentTerms,
      commissionUsdCents: moneyInputToCents(input.commissionUsd),
      paymentDate: input.paymentDate,
      pickupForecast: input.pickupForecast,
      freightCents: freightInputToCents(input.freight),
      freightText: freightInputToText(input.freight),
      notes: input.notes
    };

    const updateData: Prisma.OrderUpdateInput = {
      customer: { connect: { id: nextData.customerId } },
      salesResponsible: nextData.salesResponsibleId ? { connect: { id: nextData.salesResponsibleId } } : { disconnect: true },
      salesResponsibleNameSnapshot: nextData.salesResponsibleNameSnapshot,
      contractType: { connect: { id: nextData.contractTypeId } },
      contractTypeNameSnapshot: nextData.contractTypeNameSnapshot,
      rawMaterialClosing: { connect: { id: nextData.rawMaterialClosingId } },
      rawMaterialClosingNameSnapshot: nextData.rawMaterialClosingNameSnapshot,
      customerName: nextData.customerName,
      city: nextData.city,
      cnpj: nextData.cnpj,
      product: { connect: { id: nextData.productId } },
      productNameSnapshot: nextData.productNameSnapshot,
      productUnitSnapshot: nextData.productUnitSnapshot,
      quantityScaled: nextData.quantityScaled,
      package: { connect: { id: nextData.packageId } },
      packageNameSnapshot: nextData.packageNameSnapshot,
      currency: { connect: { id: nextData.currencyId } },
      currencyCodeSnapshot: nextData.currencyCodeSnapshot,
      currencySymbolSnapshot: nextData.currencySymbolSnapshot,
      unitPriceCents: nextData.unitPriceCents,
      dollarRateScaled: nextData.dollarRateScaled,
      dollarRateText: nextData.dollarRateText,
      paymentTerms: nextData.paymentTerms,
      commissionUsdCents: nextData.commissionUsdCents,
      paymentDate: nextData.paymentDate,
      pickupForecast: nextData.pickupForecast,
      freightCents: nextData.freightCents,
      freightText: nextData.freightText,
      notes: nextData.notes,
      lastChangedBy: { connect: { id: user.id } }
    };

    const trackedFields: Array<keyof typeof nextData> = [
      "contractTypeId",
      "contractTypeNameSnapshot",
      "salesResponsibleId",
      "salesResponsibleNameSnapshot",
      "rawMaterialClosingId",
      "rawMaterialClosingNameSnapshot",
      "customerName",
      "city",
      "cnpj",
      "customerId",
      "productId",
      "productNameSnapshot",
      "quantityScaled",
      "packageId",
      "packageNameSnapshot",
      "currencyId",
      "currencyCodeSnapshot",
      "unitPriceCents",
      "dollarRateScaled",
      "dollarRateText",
      "paymentTerms",
      "commissionUsdCents",
      "paymentDate",
      "pickupForecast",
      "freightCents",
      "freightText",
      "notes"
    ];
    const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = trackedFields
      .map((field) => ({ field, oldValue: stringifyChange(current[field]), newValue: stringifyChange(nextData[field]) }))
      .filter((change) => change.oldValue !== change.newValue);

    const previousItems = await tx.orderRawMaterial.findMany({ where: { orderId }, orderBy: { rawMaterialNameSnapshot: "asc" } });
    const updated = await tx.order.update({ where: { id: orderId }, data: updateData });
    if (options.updateTechnicalList && userCanManageTechnicalList) {
      await tx.orderRawMaterial.deleteMany({ where: { orderId } });
      if (technicalItems.length > 0) await tx.orderRawMaterial.createMany({ data: technicalItems.map((item) => ({ orderId, ...item })) });
      const nextItemsText = technicalItems.map((item) => `${item.rawMaterialNameSnapshot}:${item.quantityKgScaled}:${item.priceCents}`).join(";");
      const previousItemsText = previousItems.map((item) => `${item.rawMaterialNameSnapshot}:${item.quantityKgScaled}:${item.priceCents ?? ""}`).join(";");
      if (nextItemsText !== previousItemsText) changes.push({ field: "technicalClosingItems", oldValue: previousItemsText || null, newValue: nextItemsText || null });
    }
    if (changes.length > 0) {
      await tx.orderChangeHistory.createMany({
        data: changes.map((change) => ({ orderId, changedById: user.id, field: change.field, oldValue: change.oldValue, newValue: change.newValue }))
      });
    }
    await tx.auditLog.create({
      data: {
        action: changes.some((change) => change.field === "technicalClosingItems") ? (previousItems.length === 0 ? "ORDER_TECHNICAL_LIST_CREATED" : "ORDER_TECHNICAL_LIST_UPDATED") : "ORDER_UPDATED",
        entity: "Order",
        entityId: orderId,
        userId: user.id,
        beforeData: JSON.stringify({ number: current.number }),
        afterData: JSON.stringify({ changedFields: changes.map((change) => change.field) }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });
    return updated;
  });
}

export async function updateOrderTechnicalList(user: CurrentUser, orderId: string, input: TechnicalListUpdateInput) {
  if (!canManageTechnicalList(user)) throw new Error("Seu perfil não possui permissão para cadastrar ou alterar a Lista Técnica.");
  const meta = await getRequestMeta();
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, number: true, quantityScaled: true, status: true } });
    if (!order) throw new Error("Pedido não encontrado.");
    if (order.status === "CANCELADO") throw new Error("Não é possível alterar a Lista Técnica de um pedido cancelado.");
    if (order.quantityScaled <= 0) throw new Error("A quantidade do pedido deve ser maior que zero.");

    const ids = input.technicalItems.map((item) => item.rawMaterialId);
    if (new Set(ids).size !== ids.length) throw new Error("Não repita a mesma matéria-prima no pedido.");
    const materials = await tx.rawMaterial.findMany({ where: { id: { in: ids }, active: true } });
    if (materials.length !== ids.length) throw new Error("Matéria-prima ativa não encontrada.");
    const byId = new Map(materials.map((item) => [item.id, item]));
    const technicalItems = input.technicalItems.map((item) => {
      const material = byId.get(item.rawMaterialId);
      if (!material) throw new Error("Matéria-prima ativa não encontrada.");
      const quantityKgScaled = quantityInputToScaled(item.quantityKg) ?? 0;
      const priceCents = moneyInputToCents(item.price);
      if (quantityKgScaled <= 0) throw new Error("A quantidade em KG deve ser maior que zero.");
      if (priceCents == null) throw new Error("Informe o preço.");
      if (priceCents < 0) throw new Error("O preço da matéria-prima não pode ser negativo.");
      return {
        rawMaterialId: material.id,
        rawMaterialNameSnapshot: material.name,
        quantityKgScaled,
        quantityTonsScaled: calculateTechnicalTonsScaled(quantityKgScaled, order.quantityScaled),
        priceCents
      };
    });

    const previousItems = await tx.orderRawMaterial.findMany({ where: { orderId }, orderBy: { rawMaterialNameSnapshot: "asc" } });
    await tx.orderRawMaterial.deleteMany({ where: { orderId } });
    await tx.orderRawMaterial.createMany({ data: technicalItems.map((item) => ({ orderId, ...item })) });

    const nextItemsText = technicalItems.map((item) => `${item.rawMaterialNameSnapshot}:${item.quantityKgScaled}:${item.quantityTonsScaled}:${item.priceCents}`).join(";");
    const previousItemsText = previousItems.map((item) => `${item.rawMaterialNameSnapshot}:${item.quantityKgScaled}:${item.quantityTonsScaled}:${item.priceCents ?? ""}`).join(";");
    if (nextItemsText !== previousItemsText) {
      await tx.orderChangeHistory.create({
        data: { orderId, changedById: user.id, field: "technicalClosingItems", oldValue: previousItemsText || null, newValue: nextItemsText || null }
      });
    }
    await tx.auditLog.create({
      data: {
        action: previousItems.length === 0 ? "ORDER_TECHNICAL_LIST_CREATED" : "ORDER_TECHNICAL_LIST_UPDATED",
        entity: "Order",
        entityId: orderId,
        userId: user.id,
        beforeData: JSON.stringify({ number: order.number, technicalItems: previousItemsText || null }),
        afterData: JSON.stringify({ number: order.number, technicalItems: nextItemsText || null }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });
    return { ok: true };
  });
}

function parseListInput(input: URLSearchParams | Record<string, string | string[] | undefined>) {
  if (input instanceof URLSearchParams) return Object.fromEntries(input.entries());
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
}

export function parseOrdersListQuery(input: URLSearchParams | Record<string, string | string[] | undefined>): OrdersListQueryInput {
  return ordersListQuerySchema.parse(parseListInput(input));
}

export async function listOrders(user: CurrentUser, scope: OrdersListScope, query: OrdersListQueryInput = ordersListQuerySchema.parse({})) {
  if (scope === "all") assertPermission(user, "PEDIDO_VISUALIZAR_TODOS");
  if (scope === "own") assertPermission(user, "PEDIDO_VISUALIZAR_PROPRIOS");
  const where = buildOrdersListWhere(query, user, scope);
  const page = query.page;
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { solicitationAt: "desc" },
      skip: (page - 1) * ordersListPageSize,
      take: ordersListPageSize
    }),
    prisma.order.count({ where })
  ]);
  return {
    orders,
    total,
    page,
    pageSize: ordersListPageSize,
    totalPages: Math.max(1, Math.ceil(total / ordersListPageSize))
  };
}

export async function orderListOptions(user: CurrentUser, scope: OrdersListScope) {
  if (scope === "all") assertPermission(user, "PEDIDO_VISUALIZAR_TODOS");
  if (scope === "own") assertPermission(user, "PEDIDO_VISUALIZAR_PROPRIOS");
  const [customers, products, contractTypes, rawMaterialClosings, representatives] = await Promise.all([
    prisma.customer.findMany({ select: { id: true, name: true, city: true, active: true }, orderBy: [{ name: "asc" }, { city: "asc" }] }),
    prisma.product.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    prisma.contractType.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    prisma.rawMaterialClosing.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
    scope === "all"
      ? prisma.user.findMany({ where: { createdOrders: { some: {} } }, select: { id: true, fullName: true, active: true }, orderBy: { fullName: "asc" } })
      : Promise.resolve([])
  ]);
  return { customers, products, contractTypes, rawMaterialClosings, representatives };
}

export async function getOrderForUser(user: CurrentUser, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      statusHistory: { include: { changedBy: true }, orderBy: { changedAt: "desc" } },
      changeHistory: { include: { changedBy: true }, orderBy: { changedAt: "desc" } },
      technicalClosingItems: { include: { rawMaterial: true }, orderBy: { rawMaterialNameSnapshot: "asc" } }
    }
  });
  if (!order) return null;
  const canViewAll = user.permissions.includes("PEDIDO_VISUALIZAR_TODOS");
  if (!canViewAll && order.createdById !== user.id) throw new Error("Pedido não encontrado.");
  return order;
}

export async function changeOrderStatus(user: CurrentUser, orderId: string, input: OrderStatusInput) {
  const { status, justification } = input;
  const sapOrderNumber = input.sapOrderNumber?.trim();
  assertPermission(user, "PEDIDO_ALTERAR_STATUS");
  if (status === "APROVADO") assertPermission(user, "PEDIDO_APROVAR");
  if (status === "CANCELADO" && !justification?.trim()) throw new Error("A justificativa é obrigatória para cancelar.");
  if (["RECEBIDO", "APROVADO", "EM_CRIACAO"].includes(status) && sapOrderNumber) {
    throw new Error("O Pedido SAP só pode ser preenchido quando o pedido estiver na etapa Pedido Criado.");
  }
  const meta = await getRequestMeta();
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error("Pedido não encontrado.");
    if (status !== "CANCELADO" && status !== "RECEBIDO") {
      const message = status === "APROVADO" && order.status === "RECEBIDO"
        ? "A Lista Técnica deve ser cadastrada antes de aprovar o pedido."
        : "O pedido não pode avançar porque a Lista Técnica está incompleta.";
      try {
        await assertTechnicalListCompleteForStatus(tx, orderId, message);
      } catch (error) {
        await tx.auditLog.create({
          data: {
            action: status === "APROVADO" ? "ORDER_APPROVAL_BLOCKED_MISSING_TECHNICAL_LIST" : "ORDER_STATUS_BLOCKED_INCOMPLETE_TECHNICAL_LIST",
            entity: "Order",
            entityId: orderId,
            userId: user.id,
            beforeData: JSON.stringify({ status: order.status }),
            afterData: JSON.stringify({ requestedStatus: status }),
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent
          }
        });
        throw error;
      }
    }
    const nextSapOrderNumber = ["PEDIDO_CRIADO", "ENVIADO_PARA_ASSINATURA"].includes(status) ? sapOrderNumber || order.sapOrderNumber : order.sapOrderNumber;
    if (["PEDIDO_CRIADO", "ENVIADO_PARA_ASSINATURA"].includes(status) && !nextSapOrderNumber?.trim()) {
      throw new Error("Informe o Pedido SAP para esta etapa.");
    }
    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status,
        lastChangedBy: { connect: { id: user.id } },
        cancelledAt: status === "CANCELADO" ? new Date() : order.cancelledAt,
        cancellationReason: status === "CANCELADO" ? justification : order.cancellationReason,
        sapOrderNumber: nextSapOrderNumber
      }
    });
    await tx.orderStatusHistory.create({
      data: { orderId, previousStatus: order.status, newStatus: status, changedById: user.id, justification: status === "PEDIDO_CRIADO" && nextSapOrderNumber ? `${justification ?? ""} Pedido SAP: ${nextSapOrderNumber}`.trim() : justification, ipAddress: meta.ipAddress }
    });
    await tx.auditLog.create({
      data: {
        action: order.sapOrderNumber !== nextSapOrderNumber ? (order.sapOrderNumber ? "ORDER_SAP_NUMBER_UPDATED" : "ORDER_SAP_NUMBER_ADDED") : "ORDER_STATUS_UPDATED",
        entity: "Order",
        entityId: orderId,
        userId: user.id,
        beforeData: JSON.stringify({ status: order.status, sapOrderNumber: order.sapOrderNumber }),
        afterData: JSON.stringify({ status, justification, sapOrderNumber: nextSapOrderNumber }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent
      }
    });
    return updated;
  });
}

export async function dashboardData(user: CurrentUser) {
  const where = buildDashboardCountsWhere(user);
  const counts = await prisma.order.groupBy({ by: ["status"], where, _count: { _all: true } });
  return {
    counts: normalizeDashboardStatusCounts(counts.map((item) => ({ status: item.status, count: item._count._all })))
  };
}

export async function recordLogout(user: CurrentUser) {
  await auditLog({ action: "LOGOUT", entity: "User", entityId: user.id, userId: user.id, ...(await getRequestMeta()) });
}
