import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCurrency, createCustomer, createPackage, createProduct, createRawMaterial, createRawMaterialClosing, updateContractType, updateProduct } from "@/server/catalog-service";

const {
  customerFindFirst,
  customerCreate,
  productFindFirst,
  productCreate,
  productUpdate,
  packageFindFirst,
  packageCreate,
  currencyFindFirst,
  currencyCreate,
  contractTypeFindFirst,
  contractTypeUpdate,
  rawMaterialClosingFindFirst,
  rawMaterialClosingCreate,
  rawMaterialFindFirst,
  rawMaterialCreate,
  auditLog
} = vi.hoisted(() => ({
  customerFindFirst: vi.fn(),
  customerCreate: vi.fn(),
  productFindFirst: vi.fn(),
  productCreate: vi.fn(),
  productUpdate: vi.fn(),
  packageFindFirst: vi.fn(),
  packageCreate: vi.fn(),
  currencyFindFirst: vi.fn(),
  currencyCreate: vi.fn(),
  contractTypeFindFirst: vi.fn(),
  contractTypeUpdate: vi.fn(),
  rawMaterialClosingFindFirst: vi.fn(),
  rawMaterialClosingCreate: vi.fn(),
  rawMaterialFindFirst: vi.fn(),
  rawMaterialCreate: vi.fn(),
  auditLog: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({
  assertPermission: vi.fn((user: { permissions: string[] }, permission: string) => {
    if (!user.permissions.includes(permission)) throw new Error(`Permissão negada: ${permission}`);
  })
}));
vi.mock("@/server/audit", () => ({ auditLog: (...args: unknown[]) => auditLog(...args) }));
vi.mock("@/server/db", () => ({
  prisma: {
    customer: { findFirst: customerFindFirst, create: customerCreate },
    product: { findFirst: productFindFirst, create: productCreate, update: productUpdate },
    package: { findFirst: packageFindFirst, create: packageCreate },
    currency: { findFirst: currencyFindFirst, create: currencyCreate },
    contractType: { findFirst: contractTypeFindFirst, update: contractTypeUpdate },
    rawMaterialClosing: { findFirst: rawMaterialClosingFindFirst, create: rawMaterialClosingCreate },
    rawMaterial: { findFirst: rawMaterialFindFirst, create: rawMaterialCreate }
  }
}));

const user = {
  id: "user_1",
  fullName: "Usuário",
  username: "user",
  email: "user@example.com",
  phone: "",
  cpf: null,
  position: null,
  mustChangePassword: false,
  roles: [],
  permissions: [
    "CLIENTE_CRIAR",
    "PRODUTO_CRIAR",
    "PRODUTO_EDITAR",
    "EMBALAGEM_CRIAR",
    "MOEDA_CRIAR",
    "TIPO_CONTRATO_EDITAR",
    "FECHAMENTO_MP_CRIAR",
    "MATERIA_PRIMA_CRIAR"
  ]
};

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("validação de duplicidade dos cadastros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customerFindFirst.mockResolvedValue(null);
    customerCreate.mockResolvedValue({});
    productFindFirst.mockResolvedValue(null);
    productCreate.mockResolvedValue({});
    productUpdate.mockResolvedValue({});
    packageFindFirst.mockResolvedValue(null);
    packageCreate.mockResolvedValue({});
    currencyFindFirst.mockResolvedValue(null);
    currencyCreate.mockResolvedValue({});
    contractTypeFindFirst.mockResolvedValue(null);
    contractTypeUpdate.mockResolvedValue({ id: "contract_1", name: "CONTRATO", active: true });
    rawMaterialClosingFindFirst.mockResolvedValue(null);
    rawMaterialClosingCreate.mockResolvedValue({ id: "closing_1", name: "TIPO MP" });
    rawMaterialFindFirst.mockResolvedValue(null);
    rawMaterialCreate.mockResolvedValue({ id: "raw_1", name: "CAFE" });
  });

  it("bloqueia produto com mesmo nome, unidade e descrição", async () => {
    productFindFirst.mockResolvedValueOnce({ id: "product_1" });
    await expect(createProduct(user, form({ name: "cafe", unit: "kg", description: "torrado", active: "true" }))).rejects.toThrow("Produto já cadastrado com este nome, unidade e descrição.");
    expect(productCreate).not.toHaveBeenCalled();
  });

  it("permite atualizar produto quando a duplicidade encontrada não é o próprio registro", async () => {
    await updateProduct(user, "product_1", form({ name: "cafe", unit: "kg", description: "torrado", active: "true" }));
    expect(productFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { not: "product_1" } })
    }));
    expect(productUpdate).toHaveBeenCalled();
  });

  it("bloqueia cliente com CNPJ já cadastrado", async () => {
    customerFindFirst.mockResolvedValueOnce({ id: "customer_1" });
    await expect(createCustomer(user, form({ name: "cliente", city: "curitiba", cnpj: "11.222.333/0001-81", active: "true" }))).rejects.toThrow("Cliente já cadastrado com este CNPJ.");
    expect(customerCreate).not.toHaveBeenCalled();
  });

  it("bloqueia embalagem e moeda duplicadas por seus identificadores naturais", async () => {
    packageFindFirst.mockResolvedValueOnce({ id: "package_1" });
    await expect(createPackage(user, form({ name: "saco", capacity: "25", unit: "kg", weight: "", description: "", active: "true" }))).rejects.toThrow("Embalagem já cadastrada com este nome.");

    currencyFindFirst.mockResolvedValueOnce({ id: "currency_1" });
    await expect(createCurrency(user, form({ name: "real", code: "brl", symbol: "R$", decimalPlaces: "2", active: "true" }))).rejects.toThrow("Moeda já cadastrada com este código.");
  });

  it("bloqueia tipos de contrato, tipos de MP e matérias-primas duplicados por nome", async () => {
    contractTypeFindFirst.mockResolvedValueOnce({ id: "contract_2" });
    await expect(updateContractType(user, "contract_1", form({ name: "contrato", active: "true" }))).rejects.toThrow("Tipo de contrato já cadastrado.");

    rawMaterialClosingFindFirst.mockResolvedValueOnce({ id: "closing_1" });
    await expect(createRawMaterialClosing(user, form({ name: "tipo mp", active: "true" }))).rejects.toThrow("Tipo de MP já cadastrado.");

    rawMaterialFindFirst.mockResolvedValueOnce({ id: "raw_1" });
    await expect(createRawMaterial(user, form({ name: "cafe", active: "true" }))).rejects.toThrow("Matéria-prima já cadastrada.");
  });
});
