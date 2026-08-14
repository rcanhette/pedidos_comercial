import ExcelJS from "exceljs";
import { readFileSync } from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bulkImportMaxFileSize, createBulkImportTemplateWorkbook, importBulkWorkbook, userCanAccessBulkImport, validateBulkImportWorkbook, type BulkImportKind } from "@/server/bulk-import-service";

const { auditLog, customerFindMany, productFindMany, rawMaterialFindMany, customerCreateMany, productCreateMany, rawMaterialCreateMany } = vi.hoisted(() => ({
  auditLog: vi.fn(),
  customerFindMany: vi.fn(async (): Promise<unknown[]> => []),
  productFindMany: vi.fn(async (): Promise<unknown[]> => []),
  rawMaterialFindMany: vi.fn(async (): Promise<unknown[]> => []),
  customerCreateMany: vi.fn(),
  productCreateMany: vi.fn(),
  rawMaterialCreateMany: vi.fn()
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({
  getRequestMeta: vi.fn(async () => ({ ipAddress: "127.0.0.1", userAgent: "vitest" })),
  assertPermission: vi.fn((user: { permissions: string[] }, permission: string) => {
    if (!user.permissions.includes(permission)) throw new Error(`Permissão negada: ${permission}`);
  })
}));
vi.mock("@/server/audit", () => ({ auditLog: (...args: unknown[]) => auditLog(...args) }));
vi.mock("@/server/db", () => ({
  prisma: {
    customer: { findMany: customerFindMany },
    product: { findMany: productFindMany },
    rawMaterial: { findMany: rawMaterialFindMany },
    $transaction: vi.fn(async (callback) => callback({
      customer: { findMany: customerFindMany, createMany: customerCreateMany },
      product: { findMany: productFindMany, createMany: productCreateMany },
      rawMaterial: { findMany: rawMaterialFindMany, createMany: rawMaterialCreateMany }
    }))
  }
}));

function user(permissions: string[]) {
  return { id: "user_1", fullName: "Usuário", username: "user", email: "u@e.com", phone: "", cpf: null, position: null, active: true, mustChangePassword: false, roles: [], permissions };
}

async function workbookFile(kind: BulkImportKind, rows: string[][], options: { sheet?: string; headers?: string[]; fileName?: string } = {}) {
  const sheetName = options.sheet ?? (kind === "customers" ? "CLIENTES" : kind === "products" ? "PRODUTOS" : "MATERIAS_PRIMAS");
  const headers = options.headers ?? (kind === "customers" ? ["CLIENTE", "CIDADE", "CNPJ"] : kind === "products" ? ["PRODUTO", "UNIDADE", "DESCRICAO"] : ["MATERIA_PRIMA"]);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return new File([buffer], options.fileName ?? "importacao.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

describe("importação em massa de cadastros", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    customerFindMany.mockResolvedValue([]);
    productFindMany.mockResolvedValue([]);
    rawMaterialFindMany.mockResolvedValue([]);
    customerCreateMany.mockResolvedValue({ count: 1 });
    productCreateMany.mockResolvedValue({ count: 1 });
    rawMaterialCreateMany.mockResolvedValue({ count: 1 });
  });

  it("expõe tela, rota de modelo e menu administrativo", () => {
    expect(readFileSync("src/app/(app)/importacao-em-massa/page.tsx", "utf8")).toContain("Importação em Massa");
    expect(readFileSync("src/app/api/importacao-em-massa/modelo/route.ts", "utf8")).toContain("modelo_importacao_cadastros.xlsx");
    expect(readFileSync("src/app/api/importacao-em-massa/modelo/route.ts", "utf8")).toContain("modelo_importacao_clientes.xlsx");
    expect(readFileSync("src/lib/sidebar-menu.ts", "utf8")).toContain("/importacao-em-massa");
  });

  it("permite acesso somente para quem pode criar pelo menos um cadastro importável", () => {
    expect(userCanAccessBulkImport(user(["CLIENTE_CRIAR"]))).toBe(true);
    expect(userCanAccessBulkImport(user(["PRODUTO_CRIAR"]))).toBe(true);
    expect(userCanAccessBulkImport(user(["MATERIA_PRIMA_CRIAR"]))).toBe(true);
    expect(userCanAccessBulkImport(user(["CLIENTE_VISUALIZAR"]))).toBe(false);
  });

  it("gera modelo com abas e cabeçalhos esperados", async () => {
    const file = await createBulkImportTemplateWorkbook();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet("INSTRUCOES")).toBeTruthy();
    expect(workbook.getWorksheet("CLIENTES")?.getRow(1).values).toEqual([undefined, "CLIENTE", "CIDADE", "CNPJ"]);
    expect(workbook.getWorksheet("PRODUTOS")?.getRow(1).values).toEqual([undefined, "PRODUTO", "UNIDADE", "DESCRICAO"]);
    expect(workbook.getWorksheet("MATERIAS_PRIMAS")?.getRow(1).values).toEqual([undefined, "MATERIA_PRIMA"]);
  });

  it("gera modelo separado por tipo de cadastro", async () => {
    const file = await createBulkImportTemplateWorkbook("products");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet("INSTRUCOES")).toBeTruthy();
    expect(workbook.getWorksheet("CLIENTES")).toBeUndefined();
    expect(workbook.getWorksheet("PRODUTOS")?.getRow(1).values).toEqual([undefined, "PRODUTO", "UNIDADE", "DESCRICAO"]);
    expect(workbook.getWorksheet("MATERIAS_PRIMAS")).toBeUndefined();
  });

  it("rejeita arquivo diferente de XLSX e arquivo acima do limite", async () => {
    await expect(validateBulkImportWorkbook(user(["CLIENTE_CRIAR"]), "customers", new File(["x"], "dados.csv"))).rejects.toThrow("Selecione um arquivo .xlsx.");
    await expect(validateBulkImportWorkbook(user(["CLIENTE_CRIAR"]), "customers", new File([new Uint8Array(bulkImportMaxFileSize + 1)], "dados.xlsx"))).rejects.toThrow("O arquivo excede o tamanho máximo permitido de 5 MB.");
  });

  it("detecta aba inexistente, cabeçalho incorreto e planilha vazia", async () => {
    await expect(validateBulkImportWorkbook(user(["CLIENTE_CRIAR"]), "customers", await workbookFile("customers", [["CLIENTE A", "CURITIBA", "11.222.333/0001-81"]], { sheet: "OUTRA" }))).rejects.toThrow("Aba CLIENTES não encontrada.");
    await expect(validateBulkImportWorkbook(user(["CLIENTE_CRIAR"]), "customers", await workbookFile("customers", [["CLIENTE A", "CURITIBA", "11.222.333/0001-81"]], { headers: ["NOME", "CIDADE", "CNPJ"] }))).rejects.toThrow("Cabeçalho incorreto.");
    await expect(validateBulkImportWorkbook(user(["CLIENTE_CRIAR"]), "customers", await workbookFile("customers", []))).rejects.toThrow("Planilha sem dados");
  });

  it("valida clientes, apresenta prévia e normaliza textos em maiúsculo", async () => {
    const result = await validateBulkImportWorkbook(user(["CLIENTE_CRIAR"]), "customers", await workbookFile("customers", [["cliente exemplo", "curitiba", "11.222.333/0001-81"]]));
    expect(result.ok).toBe(true);
    expect(result.total).toBe(1);
    expect(result.valid).toBe(1);
    expect(result.new).toBe(1);
    expect(result.invalid).toBe(0);
    expect(result.rows[0].status).toBe("NOVO");
    expect(result.rows[0].values).toMatchObject({ CLIENTE: "CLIENTE EXEMPLO", CIDADE: "CURITIBA", CNPJ: "11222333000181" });
  });

  it("valida produtos e matérias-primas", async () => {
    const products = await validateBulkImportWorkbook(user(["PRODUTO_CRIAR"]), "products", await workbookFile("products", [["produto a", "kg", "descricao"]]));
    const rawMaterials = await validateBulkImportWorkbook(user(["MATERIA_PRIMA_CRIAR"]), "rawMaterials", await workbookFile("rawMaterials", [["materia prima a"]]));
    expect(products.rows[0].values).toMatchObject({ PRODUTO: "PRODUTO A", UNIDADE: "KG", DESCRICAO: "DESCRICAO" });
    expect(rawMaterials.rows[0].values).toMatchObject({ MATERIA_PRIMA: "MATERIA PRIMA A" });
  });

  it("detecta erros por linha e impede importação com erro", async () => {
    const result = await validateBulkImportWorkbook(user(["CLIENTE_CRIAR"]), "customers", await workbookFile("customers", [["CLIENTE A", "CURITIBA", "123"]]));
    expect(result.ok).toBe(false);
    expect(result.invalid).toBe(1);
    expect(result.errors[0]).toMatchObject({ line: 2, field: "CNPJ", value: "123", error: "CNPJ inválido. Verifique os números informados." });
    await expect(importBulkWorkbook(user(["CLIENTE_CRIAR"]), "customers", await workbookFile("customers", [["CLIENTE A", "CURITIBA", "123"]]))).rejects.toThrow("A planilha possui erros.");
  });

  it("detecta duplicidade na planilha", async () => {
    const result = await validateBulkImportWorkbook(user(["PRODUTO_CRIAR"]), "products", await workbookFile("products", [["produto a", "kg", ""], ["PRODUTO A", "KG", ""]]));
    expect(result.ok).toBe(true);
    expect(result.new).toBe(1);
    expect(result.duplicated).toBe(1);
    expect(result.invalid).toBe(0);
    expect(result.rows[0].status).toBe("NOVO");
    expect(result.rows[1].status).toBe("DUPLICADO NA PLANILHA");
  });

  it("marca registro existente no banco sem tratar como erro", async () => {
    rawMaterialFindMany.mockResolvedValueOnce([{ name: "materia prima a" }]);
    const result = await validateBulkImportWorkbook(user(["MATERIA_PRIMA_CRIAR"]), "rawMaterials", await workbookFile("rawMaterials", [["materia prima a"]]));
    expect(result.ok).toBe(true);
    expect(result.new).toBe(0);
    expect(result.existing).toBe(1);
    expect(result.invalid).toBe(0);
    expect(result.rows[0].status).toBe("JÁ CADASTRADO");
    expect(result.errors).toEqual([]);
    expect(result.message).toContain("Nenhum novo registro para importar.");
  });

  it("compara CNPJ existente com e sem máscara e não considera mudança de nome como novo cliente", async () => {
    customerFindMany.mockResolvedValueOnce([{ cnpj: "11222333000181" }]);
    const result = await validateBulkImportWorkbook(user(["CLIENTE_CRIAR"]), "customers", await workbookFile("customers", [["outro nome", "paranagua", "11.222.333/0001-81"]]));
    expect(result.rows[0]).toMatchObject({ status: "JÁ CADASTRADO", values: { CLIENTE: "OUTRO NOME", CIDADE: "PARANAGUA", CNPJ: "11222333000181" } });
    expect(result.existing).toBe(1);
  });

  it("considera produto existente igual quando muda apenas maiúsculas e minúsculas", async () => {
    productFindMany.mockResolvedValueOnce([{ name: "produto a" }]);
    const result = await validateBulkImportWorkbook(user(["PRODUTO_CRIAR"]), "products", await workbookFile("products", [["PRODUTO A", "kg", "nova descricao"]]));
    expect(result.rows[0].status).toBe("JÁ CADASTRADO");
    expect(result.new).toBe(0);
  });

  it("marca primeira matéria-prima inexistente como nova e repetição na planilha como duplicada", async () => {
    const result = await validateBulkImportWorkbook(user(["MATERIA_PRIMA_CRIAR"]), "rawMaterials", await workbookFile("rawMaterials", [["Milho"], ["MILHO"]]));
    expect(result.rows.map((row) => row.status)).toEqual(["NOVO", "DUPLICADO NA PLANILHA"]);
    expect(result.new).toBe(1);
    expect(result.duplicated).toBe(1);
  });

  it("importa registros válidos em transação e registra auditoria", async () => {
    await importBulkWorkbook(user(["PRODUTO_CRIAR"]), "products", await workbookFile("products", [["produto a", "kg", ""]]));
    expect(productCreateMany).toHaveBeenCalledWith({ data: [{ name: "PRODUTO A", unit: "KG", description: undefined, active: true }], skipDuplicates: true });
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ action: "PRODUCT_BULK_IMPORT", afterData: expect.objectContaining({ type: "products", quantity: 1, analyzed: 1, skippedExisting: 0, skippedDuplicated: 0 }) }));
  });

  it("importa somente linhas novas e ignora existentes e duplicadas", async () => {
    customerFindMany.mockResolvedValueOnce([{ cnpj: "11222333000181" }]).mockResolvedValueOnce([]);
    customerCreateMany.mockResolvedValueOnce({ count: 1 });
    const file = await workbookFile("customers", [
      ["cliente existente", "curitiba", "11.222.333/0001-81"],
      ["cliente novo", "paranagua", "45.723.174/0001-10"],
      ["cliente novo repetido", "paranagua", "45.723.174/0001-10"]
    ]);
    const result = await importBulkWorkbook(user(["CLIENTE_CRIAR"]), "customers", file);
    expect(customerCreateMany).toHaveBeenCalledWith({ data: [{ name: "CLIENTE NOVO", city: "PARANAGUA", cnpj: "45723174000110", active: true }], skipDuplicates: true });
    expect(result).toMatchObject({ imported: 1, analyzed: 3, skippedExisting: 1, skippedDuplicated: 1 });
  });

  it("não abre transação nem auditoria quando todos os registros já existem", async () => {
    const { prisma } = await import("@/server/db");
    customerFindMany.mockResolvedValueOnce([{ cnpj: "11222333000181" }]);
    const result = await importBulkWorkbook(user(["CLIENTE_CRIAR"]), "customers", await workbookFile("customers", [["cliente existente", "curitiba", "11.222.333/0001-81"]]));
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(customerCreateMany).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
    expect(result).toMatchObject({ imported: 0, analyzed: 1, skippedExisting: 1, skippedDuplicated: 0 });
  });

  it("revalida no backend no momento da importação e ignora concorrência", async () => {
    customerFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ cnpj: "11222333000181" }]);
    const result = await importBulkWorkbook(user(["CLIENTE_CRIAR"]), "customers", await workbookFile("customers", [["cliente a", "curitiba", "11.222.333/0001-81"]]));
    expect(customerCreateMany).not.toHaveBeenCalled();
    expect(auditLog).not.toHaveBeenCalled();
    expect(result).toMatchObject({ imported: 0, skippedExisting: 1 });
  });

  it("não registra auditoria quando a transação falha", async () => {
    customerCreateMany.mockRejectedValueOnce(new Error("falha"));
    await expect(importBulkWorkbook(user(["CLIENTE_CRIAR"]), "customers", await workbookFile("customers", [["CLIENTE A", "CURITIBA", "11.222.333/0001-81"]]))).rejects.toThrow("falha");
    expect(auditLog).not.toHaveBeenCalled();
  });
});
