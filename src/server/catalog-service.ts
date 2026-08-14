import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { assertPermission, type CurrentUser } from "./auth";
import { currencySchema, customerSchema, packageSchema, productSchema, simpleCatalogSchema } from "@/validations/catalog";
import { quantityInputToScaled } from "@/lib/scalars";
import { auditLog } from "./audit";

export type CatalogRecentOptionIds = {
  customers: string[];
  products: string[];
  packages: string[];
  currencies: string[];
  contractTypes: string[];
  rawMaterialClosings: string[];
  rawMaterials: string[];
};

function addRecentId(target: string[], id: string | null, limit = 5) {
  if (!id || target.includes(id) || target.length >= limit) return;
  target.push(id);
}

export async function recentCatalogOptionIds(): Promise<CatalogRecentOptionIds> {
  const [orders, technicalItems] = await Promise.all([
    prisma.order.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        customerId: true,
        productId: true,
        packageId: true,
        currencyId: true,
        contractTypeId: true,
        rawMaterialClosingId: true
      }
    }),
    prisma.orderRawMaterial.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { rawMaterialId: true }
    })
  ]);

  const recent: CatalogRecentOptionIds = {
    customers: [],
    products: [],
    packages: [],
    currencies: [],
    contractTypes: [],
    rawMaterialClosings: [],
    rawMaterials: []
  };

  for (const order of orders) {
    addRecentId(recent.customers, order.customerId);
    addRecentId(recent.products, order.productId);
    addRecentId(recent.packages, order.packageId);
    addRecentId(recent.currencies, order.currencyId);
    addRecentId(recent.contractTypes, order.contractTypeId);
    addRecentId(recent.rawMaterialClosings, order.rawMaterialClosingId);
  }
  for (const item of technicalItems) addRecentId(recent.rawMaterials, item.rawMaterialId);

  return recent;
}

export async function catalogOptions({ includeInactive = false }: { includeInactive?: boolean } = {}) {
  const where = includeInactive ? undefined : { active: true };
  const [customers, products, packages, currencies, contractTypes, rawMaterialClosings, rawMaterials] = await Promise.all([
    prisma.customer.findMany({ where, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where, orderBy: { name: "asc" } }),
    prisma.package.findMany({ where, orderBy: { name: "asc" } }),
    prisma.currency.findMany({ where, orderBy: { code: "asc" } }),
    prisma.contractType.findMany({ where, orderBy: { name: "asc" } }),
    prisma.rawMaterialClosing.findMany({ where, orderBy: { name: "asc" } }),
    prisma.rawMaterial.findMany({ where, orderBy: { name: "asc" } })
  ]);
  return { customers, products, packages, currencies, contractTypes, rawMaterialClosings, rawMaterials, recentOptionIds: await recentCatalogOptionIds() };
}

export const catalogPageSize = 50;
export type CatalogKind = "customers" | "products" | "packages" | "currencies" | "contractTypes" | "rawMaterialClosings" | "rawMaterials";

export type CatalogListQuery = {
  page?: number;
  search?: string;
};

export type CatalogListResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
};

function normalizedCatalogQuery(query: CatalogListQuery = {}) {
  const search = query.search?.trim() ?? "";
  const page = Number.isFinite(query.page) && query.page && query.page > 0 ? Math.floor(query.page) : 1;
  return { page, search };
}

function pageResult<T>(items: T[], total: number, page: number, search: string): CatalogListResult<T> {
  return { items, total, page, pageSize: catalogPageSize, totalPages: Math.max(1, Math.ceil(total / catalogPageSize)), search };
}

export async function listCatalog(kind: "customers", query?: CatalogListQuery): Promise<CatalogListResult<Awaited<ReturnType<typeof prisma.customer.findMany>>[number]>>;
export async function listCatalog(kind: "products", query?: CatalogListQuery): Promise<CatalogListResult<Awaited<ReturnType<typeof prisma.product.findMany>>[number]>>;
export async function listCatalog(kind: "packages", query?: CatalogListQuery): Promise<CatalogListResult<Awaited<ReturnType<typeof prisma.package.findMany>>[number]>>;
export async function listCatalog(kind: "currencies", query?: CatalogListQuery): Promise<CatalogListResult<Awaited<ReturnType<typeof prisma.currency.findMany>>[number]>>;
export async function listCatalog(kind: "contractTypes", query?: CatalogListQuery): Promise<CatalogListResult<Awaited<ReturnType<typeof prisma.contractType.findMany>>[number]>>;
export async function listCatalog(kind: "rawMaterialClosings", query?: CatalogListQuery): Promise<CatalogListResult<Awaited<ReturnType<typeof prisma.rawMaterialClosing.findMany>>[number]>>;
export async function listCatalog(kind: "rawMaterials", query?: CatalogListQuery): Promise<CatalogListResult<Awaited<ReturnType<typeof prisma.rawMaterial.findMany>>[number]>>;
export async function listCatalog(kind: CatalogKind, query: CatalogListQuery = {}) {
  const { page, search } = normalizedCatalogQuery(query);
  const pagination = { skip: (page - 1) * catalogPageSize, take: catalogPageSize };

  if (kind === "customers") {
    const where: Prisma.CustomerWhereInput | undefined = search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { city: { contains: search, mode: "insensitive" } }, { cnpj: { contains: search } }] } : undefined;
    const [items, total] = await prisma.$transaction([prisma.customer.findMany({ where, orderBy: { name: "asc" }, ...pagination }), prisma.customer.count({ where })]);
    return pageResult(items, total, page, search);
  }
  if (kind === "products") {
    const where: Prisma.ProductWhereInput | undefined = search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { unit: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : undefined;
    const [items, total] = await prisma.$transaction([prisma.product.findMany({ where, orderBy: { name: "asc" }, ...pagination }), prisma.product.count({ where })]);
    return pageResult(items, total, page, search);
  }
  if (kind === "packages") {
    const where: Prisma.PackageWhereInput | undefined = search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { unit: { contains: search, mode: "insensitive" } }, { description: { contains: search, mode: "insensitive" } }] } : undefined;
    const [items, total] = await prisma.$transaction([prisma.package.findMany({ where, orderBy: { name: "asc" }, ...pagination }), prisma.package.count({ where })]);
    return pageResult(items, total, page, search);
  }
  if (kind === "contractTypes") {
    const where: Prisma.ContractTypeWhereInput | undefined = search ? { name: { contains: search, mode: "insensitive" } } : undefined;
    const [items, total] = await prisma.$transaction([prisma.contractType.findMany({ where, orderBy: { name: "asc" }, ...pagination }), prisma.contractType.count({ where })]);
    return pageResult(items, total, page, search);
  }
  if (kind === "rawMaterialClosings") {
    const where: Prisma.RawMaterialClosingWhereInput | undefined = search ? { name: { contains: search, mode: "insensitive" } } : undefined;
    const [items, total] = await prisma.$transaction([prisma.rawMaterialClosing.findMany({ where, orderBy: { name: "asc" }, ...pagination }), prisma.rawMaterialClosing.count({ where })]);
    return pageResult(items, total, page, search);
  }
  if (kind === "rawMaterials") {
    const where: Prisma.RawMaterialWhereInput | undefined = search ? { name: { contains: search, mode: "insensitive" } } : undefined;
    const [items, total] = await prisma.$transaction([prisma.rawMaterial.findMany({ where, orderBy: { name: "asc" }, ...pagination }), prisma.rawMaterial.count({ where })]);
    return pageResult(items, total, page, search);
  }

  const where: Prisma.CurrencyWhereInput | undefined = search ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }, { symbol: { contains: search, mode: "insensitive" } }] } : undefined;
  const [items, total] = await prisma.$transaction([prisma.currency.findMany({ where, orderBy: { code: "asc" }, ...pagination }), prisma.currency.count({ where })]);
  return pageResult(items, total, page, search);
}

export async function createCustomer(user: CurrentUser, formData: FormData) {
  assertPermission(user, "CLIENTE_CRIAR");
  const data = customerSchema.parse(Object.fromEntries(formData));
  await assertCustomerNotDuplicated(data.cnpj);
  return prisma.customer.create({ data });
}

export async function updateCustomer(user: CurrentUser, customerId: string, formData: FormData) {
  assertPermission(user, "CLIENTE_EDITAR");
  const data = customerSchema.parse(Object.fromEntries(formData));
  await assertCustomerNotDuplicated(data.cnpj, customerId);
  return prisma.customer.update({ where: { id: customerId }, data });
}

export async function deleteCustomer(user: CurrentUser, customerId: string) {
  assertPermission(user, "CLIENTE_INATIVAR");
  const ordersCount = await prisma.order.count({ where: { customerId } });
  if (ordersCount > 0) {
    await prisma.customer.update({ where: { id: customerId }, data: { active: false } });
    return { deleted: false };
  }
  await prisma.customer.delete({ where: { id: customerId } });
  return { deleted: true };
}

export async function createProduct(user: CurrentUser, formData: FormData) {
  assertPermission(user, "PRODUTO_CRIAR");
  const data = productSchema.parse(Object.fromEntries(formData));
  await assertProductNotDuplicated(data);
  return prisma.product.create({ data });
}

export async function updateProduct(user: CurrentUser, productId: string, formData: FormData) {
  assertPermission(user, "PRODUTO_EDITAR");
  const data = productSchema.parse(Object.fromEntries(formData));
  await assertProductNotDuplicated(data, productId);
  return prisma.product.update({ where: { id: productId }, data });
}

export async function deleteProduct(user: CurrentUser, productId: string) {
  assertPermission(user, "PRODUTO_INATIVAR");
  const ordersCount = await prisma.order.count({ where: { productId } });
  if (ordersCount > 0) {
    await prisma.product.update({ where: { id: productId }, data: { active: false } });
    return { deleted: false };
  }
  await prisma.product.delete({ where: { id: productId } });
  return { deleted: true };
}

export async function createPackage(user: CurrentUser, formData: FormData) {
  assertPermission(user, "EMBALAGEM_CRIAR");
  const data = packageSchema.parse(Object.fromEntries(formData));
  await assertPackageNotDuplicated(data.name);
  return prisma.package.create({
    data: {
      name: data.name,
      description: data.description,
      capacityScaled: quantityInputToScaled(data.capacity),
      unit: data.unit,
      weightScaled: quantityInputToScaled(data.weight),
      active: data.active
    }
  });
}

export async function updatePackage(user: CurrentUser, packageId: string, formData: FormData) {
  assertPermission(user, "EMBALAGEM_EDITAR");
  const data = packageSchema.parse(Object.fromEntries(formData));
  await assertPackageNotDuplicated(data.name, packageId);
  return prisma.package.update({
    where: { id: packageId },
    data: {
      name: data.name,
      description: data.description,
      capacityScaled: quantityInputToScaled(data.capacity),
      unit: data.unit,
      weightScaled: quantityInputToScaled(data.weight),
      active: data.active
    }
  });
}

export async function deletePackage(user: CurrentUser, packageId: string) {
  assertPermission(user, "EMBALAGEM_INATIVAR");
  const ordersCount = await prisma.order.count({ where: { packageId } });
  if (ordersCount > 0) {
    await prisma.package.update({ where: { id: packageId }, data: { active: false } });
    return { deleted: false };
  }
  await prisma.package.delete({ where: { id: packageId } });
  return { deleted: true };
}

export async function createCurrency(user: CurrentUser, formData: FormData) {
  assertPermission(user, "MOEDA_CRIAR");
  const data = currencySchema.parse(Object.fromEntries(formData));
  await assertCurrencyNotDuplicated(data.code);
  return prisma.currency.create({ data });
}

export async function updateCurrency(user: CurrentUser, currencyId: string, formData: FormData) {
  assertPermission(user, "MOEDA_EDITAR");
  const data = currencySchema.parse(Object.fromEntries(formData));
  await assertCurrencyNotDuplicated(data.code, currencyId);
  return prisma.currency.update({ where: { id: currencyId }, data });
}

export async function deleteCurrency(user: CurrentUser, currencyId: string) {
  assertPermission(user, "MOEDA_INATIVAR");
  const ordersCount = await prisma.order.count({ where: { currencyId } });
  if (ordersCount > 0) {
    await prisma.currency.update({ where: { id: currencyId }, data: { active: false } });
    return { deleted: false };
  }
  await prisma.currency.delete({ where: { id: currencyId } });
  return { deleted: true };
}


function uniqueMessage(error: unknown, label: string) {
  if (error instanceof Error && error.message.includes("Unique constraint")) return new Error(`${label} já cadastrado.`);
  return error;
}

function nullableTextEquals(value: string | undefined) {
  return value === undefined ? null : { equals: value, mode: "insensitive" as const };
}

async function assertCustomerNotDuplicated(cnpj: string, currentId?: string) {
  const existing = await prisma.customer.findFirst({ where: { cnpj, id: currentId ? { not: currentId } : undefined }, select: { id: true } });
  if (existing) throw new Error("Cliente já cadastrado com este CNPJ.");
}

async function assertProductNotDuplicated(data: { name: string; unit: string; description?: string }, currentId?: string) {
  const existing = await prisma.product.findFirst({
    where: {
      id: currentId ? { not: currentId } : undefined,
      name: { equals: data.name, mode: "insensitive" },
      unit: { equals: data.unit, mode: "insensitive" },
      description: nullableTextEquals(data.description)
    },
    select: { id: true }
  });
  if (existing) throw new Error("Produto já cadastrado com este nome, unidade e descrição.");
}

async function assertPackageNotDuplicated(name: string, currentId?: string) {
  const existing = await prisma.package.findFirst({ where: { id: currentId ? { not: currentId } : undefined, name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (existing) throw new Error("Embalagem já cadastrada com este nome.");
}

async function assertCurrencyNotDuplicated(code: string, currentId?: string) {
  const existing = await prisma.currency.findFirst({ where: { id: currentId ? { not: currentId } : undefined, code: { equals: code, mode: "insensitive" } }, select: { id: true } });
  if (existing) throw new Error("Moeda já cadastrada com este código.");
}

async function assertSimpleCatalogNotDuplicated(model: "contractType" | "rawMaterialClosing" | "rawMaterial", name: string, duplicateMessage: string, currentId?: string) {
  const where = { id: currentId ? { not: currentId } : undefined, name: { equals: name, mode: "insensitive" as const } };
  const existing = model === "contractType"
    ? await prisma.contractType.findFirst({ where, select: { id: true } })
    : model === "rawMaterialClosing"
      ? await prisma.rawMaterialClosing.findFirst({ where, select: { id: true } })
      : await prisma.rawMaterial.findFirst({ where, select: { id: true } });
  if (existing) throw new Error(duplicateMessage);
}

export async function createContractType(user: CurrentUser, formData: FormData) {
  assertPermission(user, "TIPO_CONTRATO_CRIAR");
  const data = simpleCatalogSchema.parse(Object.fromEntries(formData));
  try {
    await assertSimpleCatalogNotDuplicated("contractType", data.name, "Tipo de contrato já cadastrado.");
    const item = await prisma.contractType.create({ data });
    await auditLog({ action: "CONTRACT_TYPE_CREATED", entity: "ContractType", entityId: item.id, userId: user.id, afterData: JSON.stringify({ name: item.name }) });
    return item;
  } catch (error) { throw uniqueMessage(error, "Tipo de contrato"); }
}

export async function updateContractType(user: CurrentUser, id: string, formData: FormData) {
  assertPermission(user, "TIPO_CONTRATO_EDITAR");
  const data = simpleCatalogSchema.parse(Object.fromEntries(formData));
  try {
    await assertSimpleCatalogNotDuplicated("contractType", data.name, "Tipo de contrato já cadastrado.", id);
    const item = await prisma.contractType.update({ where: { id }, data });
    await auditLog({ action: "CONTRACT_TYPE_UPDATED", entity: "ContractType", entityId: id, userId: user.id, afterData: JSON.stringify({ name: item.name, active: item.active }) });
    return item;
  } catch (error) { throw uniqueMessage(error, "Tipo de contrato"); }
}

export async function deleteContractType(user: CurrentUser, id: string) {
  assertPermission(user, "TIPO_CONTRATO_EXCLUIR");
  const ordersCount = await prisma.order.count({ where: { contractTypeId: id } });
  if (ordersCount > 0) await prisma.contractType.update({ where: { id }, data: { active: false } });
  else await prisma.contractType.delete({ where: { id } });
  await auditLog({ action: "CONTRACT_TYPE_DELETED", entity: "ContractType", entityId: id, userId: user.id });
}

export async function createRawMaterialClosing(user: CurrentUser, formData: FormData) {
  assertPermission(user, "FECHAMENTO_MP_CRIAR");
  const data = simpleCatalogSchema.parse(Object.fromEntries(formData));
  try {
    await assertSimpleCatalogNotDuplicated("rawMaterialClosing", data.name, "Tipo de MP já cadastrado.");
    const item = await prisma.rawMaterialClosing.create({ data });
    await auditLog({ action: "RAW_MATERIAL_CLOSING_CREATED", entity: "RawMaterialClosing", entityId: item.id, userId: user.id, afterData: JSON.stringify({ name: item.name }) });
    return item;
  } catch (error) { throw uniqueMessage(error, "Tipo de MP"); }
}

export async function updateRawMaterialClosing(user: CurrentUser, id: string, formData: FormData) {
  assertPermission(user, "FECHAMENTO_MP_EDITAR");
  const data = simpleCatalogSchema.parse(Object.fromEntries(formData));
  try {
    await assertSimpleCatalogNotDuplicated("rawMaterialClosing", data.name, "Tipo de MP já cadastrado.", id);
    return await prisma.rawMaterialClosing.update({ where: { id }, data });
  } catch (error) { throw uniqueMessage(error, "Tipo de MP"); }
}

export async function deleteRawMaterialClosing(user: CurrentUser, id: string) {
  assertPermission(user, "FECHAMENTO_MP_EXCLUIR");
  const ordersCount = await prisma.order.count({ where: { rawMaterialClosingId: id } });
  if (ordersCount > 0) await prisma.rawMaterialClosing.update({ where: { id }, data: { active: false } });
  else await prisma.rawMaterialClosing.delete({ where: { id } });
  await auditLog({ action: "RAW_MATERIAL_CLOSING_DELETED", entity: "RawMaterialClosing", entityId: id, userId: user.id });
}

export async function createRawMaterial(user: CurrentUser, formData: FormData) {
  assertPermission(user, "MATERIA_PRIMA_CRIAR");
  const data = simpleCatalogSchema.parse(Object.fromEntries(formData));
  try {
    await assertSimpleCatalogNotDuplicated("rawMaterial", data.name, "Matéria-prima já cadastrada.");
    const item = await prisma.rawMaterial.create({ data });
    await auditLog({ action: "RAW_MATERIAL_CREATED", entity: "RawMaterial", entityId: item.id, userId: user.id, afterData: JSON.stringify({ name: item.name }) });
    return item;
  } catch (error) { throw uniqueMessage(error, "Matéria-prima"); }
}

export async function createRawMaterialQuick(user: CurrentUser, name: string) {
  assertPermission(user, "MATERIA_PRIMA_CRIAR");
  const data = simpleCatalogSchema.parse({ name, active: true });
  try {
    await assertSimpleCatalogNotDuplicated("rawMaterial", data.name, "Matéria-prima já cadastrada.");
    const item = await prisma.rawMaterial.create({ data });
    await auditLog({ action: "RAW_MATERIAL_CREATED", entity: "RawMaterial", entityId: item.id, userId: user.id, afterData: JSON.stringify({ name: item.name }) });
    return item;
  } catch (error) { throw uniqueMessage(error, "Matéria-prima"); }
}

export async function updateRawMaterial(user: CurrentUser, id: string, formData: FormData) {
  assertPermission(user, "MATERIA_PRIMA_EDITAR");
  const data = simpleCatalogSchema.parse(Object.fromEntries(formData));
  try {
    await assertSimpleCatalogNotDuplicated("rawMaterial", data.name, "Matéria-prima já cadastrada.", id);
    return await prisma.rawMaterial.update({ where: { id }, data });
  } catch (error) { throw uniqueMessage(error, "Matéria-prima"); }
}

export async function deleteRawMaterial(user: CurrentUser, id: string) {
  assertPermission(user, "MATERIA_PRIMA_EXCLUIR");
  const ordersCount = await prisma.orderRawMaterial.count({ where: { rawMaterialId: id } });
  if (ordersCount > 0) await prisma.rawMaterial.update({ where: { id }, data: { active: false } });
  else await prisma.rawMaterial.delete({ where: { id } });
  await auditLog({ action: "RAW_MATERIAL_DELETED", entity: "RawMaterial", entityId: id, userId: user.id });
}
