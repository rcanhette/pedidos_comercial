import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config();

const prisma = new PrismaClient();
const applyChanges = process.env.APPLY_UPPERCASE_NORMALIZATION === "true";

type Row = { id: string } & Record<string, unknown>;
type Delegate = {
  findMany(args?: unknown): Promise<Row[]>;
  update(args: { where: { id: string }; data: Record<string, string | null> }): Promise<unknown>;
};

type NormalizationTarget = {
  label: string;
  delegate: Delegate;
  fields: string[];
  uniqueFields?: string[];
  fieldNormalizer?: (field: string, value: string) => string;
};

type Collision = {
  label: string;
  field: string;
  normalized: string;
  values: string[];
};

type ChangeSummary = {
  label: string;
  rows: number;
  fields: number;
};

function normalizeFreeText(value: string) {
  return value.trim().toLocaleUpperCase("pt-BR");
}

function normalizeTechnicalItemsText(value: string) {
  return value
    .split(";")
    .map((item) => {
      const [name, ...rest] = item.split(":");
      return [normalizeFreeText(name), ...rest].join(":");
    })
    .join(";");
}

function normalizeStatusJustification(value: string) {
  const sapMatch = value.match(/^(.*?)(Pedido SAP:\s*)(.*)$/i);
  if (!sapMatch) return normalizeFreeText(value);
  const [, textBeforeSap, sapLabel, sapValue] = sapMatch;
  const normalizedBefore = normalizeFreeText(textBeforeSap);
  const separator = normalizedBefore ? " " : "";
  return `${normalizedBefore}${separator}${sapLabel.trim()}: ${sapValue.trim()}`.trim();
}

function normalizeChangeHistoryValue(field: string, value: string) {
  if (field === "technicalClosingItems") return normalizeTechnicalItemsText(value);
  return normalizeFreeText(value);
}

async function findCollisions(targets: NormalizationTarget[]) {
  const collisions: Collision[] = [];
  for (const target of targets) {
    for (const field of target.uniqueFields ?? []) {
      const rows = await target.delegate.findMany({ select: { id: true, [field]: true } });
      const grouped = new Map<string, Set<string>>();
      for (const row of rows) {
        const value = row[field];
        if (typeof value !== "string" || !value.trim()) continue;
        const normalized = normalizeFreeText(value);
        const values = grouped.get(normalized) ?? new Set<string>();
        values.add(value);
        grouped.set(normalized, values);
      }
      for (const [normalized, values] of grouped) {
        if (values.size > 1) collisions.push({ label: target.label, field, normalized, values: [...values].sort() });
      }
    }
  }
  return collisions;
}

async function normalizeTarget(target: NormalizationTarget): Promise<ChangeSummary> {
  const rows = await target.delegate.findMany({ select: Object.fromEntries(["id", ...target.fields].map((field) => [field, true])) });
  let changedRows = 0;
  let changedFields = 0;

  for (const row of rows) {
    const data: Record<string, string | null> = {};
    for (const field of target.fields) {
      const value = row[field];
      if (typeof value !== "string") continue;
      const normalized = target.fieldNormalizer?.(field, value) ?? normalizeFreeText(value);
      if (normalized !== value) {
        data[field] = normalized || null;
        changedFields += 1;
      }
    }
    if (Object.keys(data).length === 0) continue;
    changedRows += 1;
    if (applyChanges) await target.delegate.update({ where: { id: row.id }, data });
  }

  return { label: target.label, rows: changedRows, fields: changedFields };
}

async function normalizeOrderChangeHistory(): Promise<ChangeSummary> {
  const textualFields = new Set([
    "contractTypeNameSnapshot",
    "rawMaterialClosingNameSnapshot",
    "customerName",
    "city",
    "productNameSnapshot",
    "productUnitSnapshot",
    "packageNameSnapshot",
    "currencyCodeSnapshot",
    "currencySymbolSnapshot",
    "dollarRateText",
    "paymentTerms",
    "freightText",
    "notes",
    "technicalClosingItems"
  ]);
  const rows = await prisma.orderChangeHistory.findMany({ select: { id: true, field: true, oldValue: true, newValue: true } });
  let changedRows = 0;
  let changedFields = 0;

  for (const row of rows) {
    if (!textualFields.has(row.field)) continue;
    const data: Record<string, string | null> = {};
    for (const key of ["oldValue", "newValue"] as const) {
      const value = row[key];
      if (typeof value !== "string") continue;
      const normalized = normalizeChangeHistoryValue(row.field, value);
      if (normalized !== value) {
        data[key] = normalized || null;
        changedFields += 1;
      }
    }
    if (Object.keys(data).length === 0) continue;
    changedRows += 1;
    if (applyChanges) await prisma.orderChangeHistory.update({ where: { id: row.id }, data });
  }

  return { label: "OrderChangeHistory", rows: changedRows, fields: changedFields };
}

async function main() {
  const targets: NormalizationTarget[] = [
    { label: "User", delegate: prisma.user, fields: ["fullName", "position"] },
    { label: "Customer", delegate: prisma.customer, fields: ["name", "city"] },
    { label: "Product", delegate: prisma.product, fields: ["name", "description", "unit"] },
    { label: "ContractType", delegate: prisma.contractType, fields: ["name"], uniqueFields: ["name"] },
    { label: "RawMaterialClosing", delegate: prisma.rawMaterialClosing, fields: ["name"], uniqueFields: ["name"] },
    { label: "RawMaterial", delegate: prisma.rawMaterial, fields: ["name"], uniqueFields: ["name"] },
    { label: "Package", delegate: prisma.package, fields: ["name", "description", "unit"], uniqueFields: ["name"] },
    { label: "Currency", delegate: prisma.currency, fields: ["name", "code", "symbol"], uniqueFields: ["code"] },
    {
      label: "Order",
      delegate: prisma.order,
      fields: [
        "representativeName",
        "contractTypeNameSnapshot",
        "rawMaterialClosingNameSnapshot",
        "customerName",
        "city",
        "productNameSnapshot",
        "productUnitSnapshot",
        "packageNameSnapshot",
        "currencyCodeSnapshot",
        "currencySymbolSnapshot",
        "dollarRateText",
        "paymentTerms",
        "freightText",
        "notes",
        "cancellationReason"
      ]
    },
    { label: "OrderRawMaterial", delegate: prisma.orderRawMaterial, fields: ["rawMaterialNameSnapshot"] },
    { label: "OrderStatusHistory", delegate: prisma.orderStatusHistory, fields: ["justification"], fieldNormalizer: (_field, value) => normalizeStatusJustification(value) }
  ];

  const collisions = await findCollisions(targets);
  if (collisions.length > 0) {
    console.error("Normalização abortada: existem valores únicos que colidiriam após converter para maiúsculo.");
    for (const collision of collisions) {
      console.error(`- ${collision.label}.${collision.field} -> ${collision.normalized}: ${collision.values.join(" | ")}`);
    }
    process.exitCode = 1;
    return;
  }

  const summaries = [];
  for (const target of targets) summaries.push(await normalizeTarget(target));
  summaries.push(await normalizeOrderChangeHistory());

  const totalRows = summaries.reduce((total, item) => total + item.rows, 0);
  const totalFields = summaries.reduce((total, item) => total + item.fields, 0);
  console.log(applyChanges ? "Normalização aplicada." : "Dry-run concluído. Nenhum dado foi alterado.");
  for (const item of summaries) console.log(`${item.label}: ${item.rows} registros / ${item.fields} campos`);
  console.log(`Total: ${totalRows} registros / ${totalFields} campos`);
  if (!applyChanges) console.log("Para aplicar: APPLY_UPPERCASE_NORMALIZATION=true npm run db:normalize-uppercase");
}

main()
  .finally(async () => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
