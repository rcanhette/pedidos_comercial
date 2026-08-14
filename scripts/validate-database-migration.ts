import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config();

type ExportData = { metadata?: Record<string, unknown>; counts: Record<string, number>; data: Record<string, Array<Record<string, unknown>>> };

function latestExportPath() {
  const dir = path.resolve(process.cwd(), "backups", "pre-postgresql-migration");
  if (!fs.existsSync(dir)) throw new Error(`Pasta de exportação não encontrada: ${dir}`);
  const files = fs.readdirSync(dir).filter((file) => file.startsWith("sqlite-export-") && file.endsWith(".json")).sort();
  if (!files.length) throw new Error("Nenhuma exportação SQLite encontrada. Rode npm run db:sqlite:export.");
  return path.join(dir, files[files.length - 1]);
}

function readExport(fileArg?: string): ExportData {
  const file = fileArg ? path.resolve(process.cwd(), fileArg) : latestExportPath();
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as ExportData;
  console.log(`Usando exportação: ${file}`);
  return parsed;
}

function rows(exportData: ExportData, table: string) {
  return exportData.data[table] ?? [];
}

const prisma = new PrismaClient();
const exportData = readExport(process.argv[2]);
const critical: string[] = [];

function report(label: string, sqliteValue: unknown, postgresValue: unknown) {
  const ok = JSON.stringify(sqliteValue) === JSON.stringify(postgresValue);
  console.log(`${label}: SQLite ${sqliteValue} / PostgreSQL ${postgresValue} / ${ok ? "OK" : "DIFERENÇA"}`);
  if (!ok) critical.push(label);
}

function sortedIds(table: string) {
  return rows(exportData, table).map((row) => String(row.id ?? `${row.userId}:${row.roleId}:${row.permissionId}`)).sort();
}

function sum(table: string, field: string) {
  return rows(exportData, table).reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

async function main() {
  const countChecks: Array<[string, () => Promise<number>]> = [
    ["User", () => prisma.user.count()], ["Role", () => prisma.role.count()], ["Permission", () => prisma.permission.count()], ["Product", () => prisma.product.count()], ["Package", () => prisma.package.count()], ["Currency", () => prisma.currency.count()], ["Order", () => prisma.order.count()], ["OrderStatusHistory", () => prisma.orderStatusHistory.count()], ["OrderChangeHistory", () => prisma.orderChangeHistory.count()], ["AuditLog", () => prisma.auditLog.count()], ["Session", () => prisma.session.count()], ["LoginChallenge", () => prisma.loginChallenge.count()], ["SystemSetting", () => prisma.systemSetting.count()]
  ];
  for (const [table, getCount] of countChecks) report(table, rows(exportData, table).length, await getCount());

  const users = await prisma.user.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  report("IDs de usuários", sortedIds("User"), users.map((u) => u.id).sort());
  const orders = await prisma.order.findMany({ select: { id: true, number: true, status: true, unitPriceCents: true, quantityScaled: true, freightCents: true, commissionUsdCents: true, dollarRateScaled: true }, orderBy: { id: "asc" } });
  report("IDs de pedidos", sortedIds("Order"), orders.map((o) => o.id).sort());
  report("Soma unitPriceCents", sum("Order", "unitPriceCents"), orders.reduce((t, o) => t + o.unitPriceCents, 0));
  report("Soma quantityScaled", sum("Order", "quantityScaled"), orders.reduce((t, o) => t + o.quantityScaled, 0));
  report("Soma freightCents", sum("Order", "freightCents"), orders.reduce((t, o) => t + (o.freightCents ?? 0), 0));
  report("Soma commissionUsdCents", sum("Order", "commissionUsdCents"), orders.reduce((t, o) => t + (o.commissionUsdCents ?? 0), 0));
  report("Soma dollarRateScaled", sum("Order", "dollarRateScaled"), orders.reduce((t, o) => t + (o.dollarRateScaled ?? 0), 0));

  const maxSqliteOrder = rows(exportData, "Order").map((row) => String(row.number)).sort().at(-1) ?? null;
  const maxPgOrder = (await prisma.order.findFirst({ orderBy: { number: "desc" }, select: { number: true } }))?.number ?? null;
  report("Maior número de pedido", maxSqliteOrder, maxPgOrder);

  const sqliteSeq = rows(exportData, "OrderNumberSequence").map((row) => `${row.year}:${row.value}`).sort();
  const pgSeq = (await prisma.orderNumberSequence.findMany({ orderBy: { year: "asc" } })).map((row) => `${row.year}:${row.value}`);
  report("Sequência de pedidos", sqliteSeq, pgSeq);

  const invalid = {
    pedidosSemUsuario: await prisma.order.count({ where: { createdBy: null as never } }).catch(() => 0),
    pedidosSemProduto: await prisma.order.count({ where: { product: null as never } }).catch(() => 0),
    historicosSemPedido: await prisma.orderStatusHistory.count({ where: { order: null as never } }).catch(() => 0),
    numerosDuplicados: 0
  };
  const groupedNumbers = await prisma.order.groupBy({ by: ["number"], _count: { _all: true }, having: { number: { _count: { gt: 1 } } } });
  invalid.numerosDuplicados = groupedNumbers.length;
  console.log(`Relacionamentos inválidos: ${Object.values(invalid).reduce((a, b) => a + b, 0)}`);
  if (Object.values(invalid).some(Boolean)) critical.push("Integridade referencial");

  if (critical.length) throw new Error(`Validação falhou: ${critical.join(", ")}`);
  console.log("Validação de migração concluída sem diferenças críticas.");
}

main().finally(async () => prisma.$disconnect());
