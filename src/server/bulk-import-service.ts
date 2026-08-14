import "server-only";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { assertPermission, type CurrentUser, getRequestMeta } from "./auth";
import { auditLog } from "./audit";
import { appName } from "@/lib/app-config";
import { customerSchema, productSchema, simpleCatalogSchema } from "@/validations/catalog";
import type { PermissionCode } from "@/lib/permissions";

export const bulkImportMaxFileSize = 5 * 1024 * 1024;
export const bulkImportMaxRows = 5000;

export const bulkImportKinds = ["customers", "products", "rawMaterials"] as const;
export type BulkImportKind = (typeof bulkImportKinds)[number];

export type BulkImportRowStatus = "NOVO" | "JÁ CADASTRADO" | "DUPLICADO NA PLANILHA" | "ERRO";
export type BulkImportRow = {
  line: number;
  values: Record<string, string>;
  status: BulkImportRowStatus;
  errors: BulkImportRowError[];
};
export type BulkImportRowError = { line: number; field: string; value?: string; error: string };
export type BulkImportValidationResult = {
  ok: boolean;
  kind: BulkImportKind;
  fileName: string;
  total: number;
  valid: number;
  new: number;
  existing: number;
  duplicated: number;
  invalid: number;
  rows: BulkImportRow[];
  errors: BulkImportRowError[];
  message?: string;
};

type BulkImportConfig = {
  label: string;
  pluralLabel: string;
  sheet: string;
  headers: string[];
  permission: PermissionCode;
  auditAction: string;
};

export const bulkImportConfig = {
  customers: {
    label: "Cliente",
    pluralLabel: "Clientes",
    sheet: "CLIENTES",
    headers: ["CLIENTE", "CIDADE", "CNPJ"],
    permission: "CLIENTE_CRIAR",
    auditAction: "CLIENT_BULK_IMPORT"
  },
  products: {
    label: "Produto",
    pluralLabel: "Produtos",
    sheet: "PRODUTOS",
    headers: ["PRODUTO", "UNIDADE", "DESCRICAO"],
    permission: "PRODUTO_CRIAR",
    auditAction: "PRODUCT_BULK_IMPORT"
  },
  rawMaterials: {
    label: "Matéria-prima",
    pluralLabel: "Matérias-primas",
    sheet: "MATERIAS_PRIMAS",
    headers: ["MATERIA_PRIMA"],
    permission: "MATERIA_PRIMA_CRIAR",
    auditAction: "RAW_MATERIAL_BULK_IMPORT"
  }
} satisfies Record<BulkImportKind, BulkImportConfig>;

function isBulkImportKind(value: unknown): value is BulkImportKind {
  return typeof value === "string" && bulkImportKinds.includes(value as BulkImportKind);
}

export function userCanAccessBulkImport(user: CurrentUser) {
  return bulkImportKinds.some((kind) => user.permissions.includes(bulkImportConfig[kind].permission));
}

export function assertBulkImportPermission(user: CurrentUser, kind: BulkImportKind) {
  assertPermission(user, bulkImportConfig[kind].permission);
}

export function parseBulkImportKind(value: FormDataEntryValue | null): BulkImportKind {
  if (!isBulkImportKind(value)) throw new Error("Tipo de cadastro inválido.");
  return value;
}

function fileName(file: File) {
  return file.name || "arquivo.xlsx";
}

async function fileToBuffer(file: File) {
  if (!file.name) throw new Error("Selecione um arquivo Excel.");
  if (!file.name.toLocaleLowerCase("pt-BR").endsWith(".xlsx")) throw new Error("Selecione um arquivo .xlsx.");
  if (file.size > bulkImportMaxFileSize) throw new Error("O arquivo excede o tamanho máximo permitido de 5 MB.");
  return Buffer.from(await file.arrayBuffer());
}

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("richText" in value && Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("").trim();
    if ("hyperlink" in value && "text" in value && typeof value.text === "string") return value.text.trim();
  }
  return String(value).trim();
}

function rowIsEmpty(row: ExcelJS.Row, headersCount: number) {
  return Array.from({ length: headersCount }, (_, index) => cellText(row.getCell(index + 1).value)).every((value) => value === "");
}

function validateHeaders(row: ExcelJS.Row, expected: string[]) {
  const found = expected.map((_, index) => cellText(row.getCell(index + 1).value).toLocaleUpperCase("pt-BR"));
  const mismatches = expected.filter((header, index) => found[index] !== header);
  if (mismatches.length > 0) throw new Error(`Cabeçalho incorreto. Esperado: ${expected.join(", ")}.`);
}

async function readWorkbook(buffer: Buffer) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    return workbook;
  } catch {
    throw new Error("Arquivo XLSX inválido ou corrompido.");
  }
}

function validateRow(kind: BulkImportKind, raw: Record<string, string>): { data: Record<string, unknown> } | { errors: Array<{ field: string; error: string }> } {
  if (kind === "customers") {
    const parsed = customerSchema.safeParse({ name: raw.CLIENTE, city: raw.CIDADE, cnpj: raw.CNPJ, active: true });
    return parsed.success
      ? { data: { name: parsed.data.name, city: parsed.data.city, cnpj: parsed.data.cnpj, active: true } }
      : { errors: parsed.error.issues.map((issue) => ({ field: issue.path[0] === "name" ? "CLIENTE" : issue.path[0] === "city" ? "CIDADE" : "CNPJ", error: issue.message })) };
  }
  if (kind === "products") {
    const parsed = productSchema.safeParse({ name: raw.PRODUTO, unit: raw.UNIDADE, description: raw.DESCRICAO, active: true });
    return parsed.success
      ? { data: { name: parsed.data.name, unit: parsed.data.unit, description: parsed.data.description, active: true } }
      : { errors: parsed.error.issues.map((issue) => ({ field: issue.path[0] === "name" ? "PRODUTO" : issue.path[0] === "unit" ? "UNIDADE" : "DESCRICAO", error: issue.message })) };
  }
  const parsed = simpleCatalogSchema.safeParse({ name: raw.MATERIA_PRIMA, active: true });
  return parsed.success
    ? { data: { name: parsed.data.name, active: true } }
    : { errors: parsed.error.issues.map((issue) => ({ field: "MATERIA_PRIMA", error: issue.message })) };
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values));
}

function normalizedLookupValue(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR");
}

async function existingValues(kind: BulkImportKind, normalizedRows: Array<{ data?: Record<string, unknown> }>, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  if (kind === "customers") {
    const cnpjs = uniqueValues(normalizedRows.map((row) => row.data?.cnpj).filter((value): value is string => typeof value === "string"));
    if (cnpjs.length === 0) return new Set<string>();
    const existing = await tx.customer.findMany({ where: { cnpj: { in: cnpjs } }, select: { cnpj: true } });
    return new Set(existing.map((item) => item.cnpj.replace(/\D/g, "")));
  }
  if (kind === "products") {
    const names = uniqueValues(normalizedRows.map((row) => row.data?.name).filter((value): value is string => typeof value === "string"));
    if (names.length === 0) return new Set<string>();
    const existing = await tx.product.findMany({ where: { name: { in: names, mode: "insensitive" } }, select: { name: true } });
    return new Set(existing.map((item) => normalizedLookupValue(item.name)));
  }
  const names = uniqueValues(normalizedRows.map((row) => row.data?.name).filter((value): value is string => typeof value === "string"));
  if (names.length === 0) return new Set<string>();
  const existing = await tx.rawMaterial.findMany({ where: { name: { in: names, mode: "insensitive" } }, select: { name: true } });
  return new Set(existing.map((item) => normalizedLookupValue(item.name)));
}

function duplicateKey(kind: BulkImportKind, data: Record<string, unknown>) {
  return kind === "customers" ? String(data.cnpj ?? "").replace(/\D/g, "") : normalizedLookupValue(String(data.name ?? ""));
}

export async function validateBulkImportWorkbook(user: CurrentUser, kind: BulkImportKind, file: File): Promise<BulkImportValidationResult> {
  assertBulkImportPermission(user, kind);
  const config = bulkImportConfig[kind];
  const buffer = await fileToBuffer(file);
  const workbook = await readWorkbook(buffer);
  const worksheet = workbook.getWorksheet(config.sheet);
  if (!worksheet) throw new Error(`Aba ${config.sheet} não encontrada.`);
  if (worksheet.rowCount < 2) throw new Error("Planilha sem dados para importar.");

  validateHeaders(worksheet.getRow(1), config.headers);

  const rows: BulkImportRow[] = [];
  const normalizedRows: Array<{ line: number; raw: Record<string, string>; data?: Record<string, unknown>; errors: BulkImportRowError[] }> = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || rowIsEmpty(row, config.headers.length)) return;
    const raw = Object.fromEntries(config.headers.map((header, index) => [header, cellText(row.getCell(index + 1).value)]));
    const validation = validateRow(kind, raw);
    const errors = "errors" in validation
      ? validation.errors.map((error) => ({ line: rowNumber, field: error.field, value: raw[error.field], error: error.error }))
      : [];
    normalizedRows.push({ line: rowNumber, raw, data: "data" in validation ? validation.data : undefined, errors });
  });

  if (normalizedRows.length === 0) throw new Error("Planilha sem dados para importar.");
  if (normalizedRows.length > bulkImportMaxRows) throw new Error("A planilha possui mais de 5.000 registros. Divida a importação em arquivos menores.");

  const seen = new Map<string, number>();
  const existing = await existingValues(kind, normalizedRows);
  for (const row of normalizedRows) {
    if (!row.data) continue;
    const key = duplicateKey(kind, row.data);
    if (!seen.has(key)) seen.set(key, row.line);
  }

  for (const row of normalizedRows) {
    let status: BulkImportRowStatus = "ERRO";
    if (row.data && row.errors.length === 0) {
      const key = duplicateKey(kind, row.data);
      if (seen.get(key) !== row.line) status = "DUPLICADO NA PLANILHA";
      else if (existing.has(key)) status = "JÁ CADASTRADO";
      else status = "NOVO";
    }
    rows.push({ line: row.line, values: row.data ? normalizedDisplayValues(kind, row.data) : row.raw, status, errors: row.errors });
  }
  const errors = rows.flatMap((row) => row.errors);
  const invalid = rows.filter((row) => row.status === "ERRO").length;
  const newRows = rows.filter((row) => row.status === "NOVO").length;
  const existingRows = rows.filter((row) => row.status === "JÁ CADASTRADO").length;
  const duplicatedRows = rows.filter((row) => row.status === "DUPLICADO NA PLANILHA").length;
  return {
    ok: invalid === 0,
    kind,
    fileName: fileName(file),
    total: rows.length,
    valid: newRows,
    new: newRows,
    existing: existingRows,
    duplicated: duplicatedRows,
    invalid,
    rows,
    errors,
    message: invalid > 0
      ? "A planilha possui erros. Corrija os registros indicados e envie o arquivo novamente."
      : newRows === 0
        ? "Nenhum novo registro para importar. Todos os registros da planilha já estão cadastrados."
        : undefined
  };
}

function normalizedDisplayValues(kind: BulkImportKind, data: Record<string, unknown>): Record<string, string> {
  if (kind === "customers") return { CLIENTE: String(data.name ?? ""), CIDADE: String(data.city ?? ""), CNPJ: String(data.cnpj ?? "") } satisfies Record<string, string>;
  if (kind === "products") return { PRODUTO: String(data.name ?? ""), UNIDADE: String(data.unit ?? ""), DESCRICAO: String(data.description ?? "") } satisfies Record<string, string>;
  return { MATERIA_PRIMA: String(data.name ?? "") };
}

async function validatedData(user: CurrentUser, kind: BulkImportKind, file: File) {
  const validation = await validateBulkImportWorkbook(user, kind, file);
  if (!validation.ok) throw new Error("A planilha possui erros. Corrija os registros indicados e envie o arquivo novamente.");
  const newRows = validation.rows.filter((row) => row.status === "NOVO");
  if (kind === "customers") return { validation, data: newRows.map((row) => ({ name: row.values.CLIENTE, city: row.values.CIDADE, cnpj: row.values.CNPJ, active: true })) };
  if (kind === "products") return { validation, data: newRows.map((row) => ({ name: row.values.PRODUTO, unit: row.values.UNIDADE, description: row.values.DESCRICAO || undefined, active: true })) };
  return { validation, data: newRows.map((row) => ({ name: row.values.MATERIA_PRIMA, active: true })) };
}

export async function importBulkWorkbook(user: CurrentUser, kind: BulkImportKind, file: File) {
  assertBulkImportPermission(user, kind);
  const { validation, data } = await validatedData(user, kind, file);
  const meta = await getRequestMeta();
  let imported = 0;
  let skippedExisting = validation.existing;

  if (data.length > 0) {
    await prisma.$transaction(async (tx) => {
      const rowsForRecheck = data.map((item) => ({ data: item as Record<string, unknown> }));
      const existing = await existingValues(kind, rowsForRecheck, tx);
      const freshData = data.filter((item) => !existing.has(duplicateKey(kind, item as Record<string, unknown>)));
      skippedExisting += data.length - freshData.length;

      if (freshData.length === 0) return;
      const result = kind === "customers"
        ? await tx.customer.createMany({ data: freshData as Prisma.CustomerCreateManyInput[], skipDuplicates: true })
        : kind === "products"
          ? await tx.product.createMany({ data: freshData as Prisma.ProductCreateManyInput[], skipDuplicates: true })
          : await tx.rawMaterial.createMany({ data: freshData as Prisma.RawMaterialCreateManyInput[], skipDuplicates: true });
      imported = result.count;
      skippedExisting += freshData.length - result.count;
    });
  }

  if (imported > 0) {
    await auditLog({
      action: bulkImportConfig[kind].auditAction,
      entity: bulkImportConfig[kind].label,
      userId: user.id,
      afterData: { type: kind, quantity: imported, analyzed: validation.total, skippedExisting, skippedDuplicated: validation.duplicated },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    });
  }

  return { kind, imported, analyzed: validation.total, skippedExisting, skippedDuplicated: validation.duplicated };
}

export async function createBulkImportTemplateWorkbook(kind?: BulkImportKind) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = appName;
  const instructions = workbook.addWorksheet("INSTRUCOES");
  instructions.addRows([
    ["Modelo de importação de cadastros"],
    [kind ? `Tipo: ${bulkImportConfig[kind].pluralLabel}.` : "Selecione um tipo por importação: Clientes, Produtos ou Matérias-primas."],
    ["Não altere os nomes das abas nem dos cabeçalhos."],
    ["A aba INSTRUCOES é ignorada."]
  ]);

  const configs = kind ? [bulkImportConfig[kind]] : Object.values(bulkImportConfig);
  for (const config of configs) {
    const worksheet = workbook.addWorksheet(config.sheet);
    worksheet.addRow(config.headers);
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns = config.headers.map((header) => ({ header, key: header, width: Math.max(18, header.length + 6) }));
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
