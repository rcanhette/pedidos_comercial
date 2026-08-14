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

function date(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return new Date(Number(value));
  return new Date(String(value));
}

function bool(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function rows(exportData: ExportData, table: string) {
  return exportData.data[table] ?? [];
}

const prisma = new PrismaClient();
const exportData = readExport(process.argv[2]);

const counts: Record<string, number> = {};
const count = (table: string, value: number) => { counts[table] = value; console.log(`${table}: ${value}`); };

async function assertTargetIsEmpty() {
  const existing = await Promise.all([
    prisma.user.count(), prisma.role.count(), prisma.permission.count(), prisma.product.count(), prisma.package.count(), prisma.currency.count(), prisma.order.count(), prisma.auditLog.count()
  ]);
  const total = existing.reduce((sum, value) => sum + value, 0);
  if (total > 0 && process.env.POSTGRES_IMPORT_TRUNCATE !== "true") {
    throw new Error("PostgreSQL de destino não está vazio. Defina POSTGRES_IMPORT_TRUNCATE=true apenas se deseja limpar as tabelas antes da importação.");
  }
}

async function main() {
  await assertTargetIsEmpty();
  await prisma.$transaction(async (tx) => {
    if (process.env.POSTGRES_IMPORT_TRUNCATE === "true") {
      await tx.loginChallenge.deleteMany();
      await tx.session.deleteMany();
      await tx.orderChangeHistory.deleteMany();
      await tx.orderStatusHistory.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.order.deleteMany();
      await tx.userPermission.deleteMany();
      await tx.userRole.deleteMany();
      await tx.rolePermission.deleteMany();
      await tx.orderNumberSequence.deleteMany();
      await tx.systemSetting.deleteMany();
      await tx.product.deleteMany();
      await tx.package.deleteMany();
      await tx.currency.deleteMany();
      await tx.permission.deleteMany();
      await tx.role.deleteMany();
      await tx.user.deleteMany();
    }

    const users = rows(exportData, "User").map((r) => ({ ...r, active: bool(r.active), mustChangePassword: bool(r.mustChangePassword), lastAccessAt: date(r.lastAccessAt), createdAt: date(r.createdAt)!, updatedAt: date(r.updatedAt)! }));
    await tx.user.createMany({ data: users as never[], skipDuplicates: true });
    count("User", users.length);

    const roles = rows(exportData, "Role").map((r) => ({ ...r, active: bool(r.active), createdAt: date(r.createdAt)!, updatedAt: date(r.updatedAt)! }));
    await tx.role.createMany({ data: roles as never[], skipDuplicates: true });
    count("Role", roles.length);

    const permissions = rows(exportData, "Permission").map((r) => ({ ...r, createdAt: date(r.createdAt)! }));
    await tx.permission.createMany({ data: permissions as never[], skipDuplicates: true });
    count("Permission", permissions.length);

    await tx.userRole.createMany({ data: rows(exportData, "UserRole") as never[], skipDuplicates: true });
    count("UserRole", rows(exportData, "UserRole").length);
    await tx.rolePermission.createMany({ data: rows(exportData, "RolePermission") as never[], skipDuplicates: true });
    count("RolePermission", rows(exportData, "RolePermission").length);
    await tx.userPermission.createMany({ data: rows(exportData, "UserPermission") as never[], skipDuplicates: true });
    count("UserPermission", rows(exportData, "UserPermission").length);

    const products = rows(exportData, "Product").map((r) => ({ ...r, active: bool(r.active), createdAt: date(r.createdAt)!, updatedAt: date(r.updatedAt)! }));
    await tx.product.createMany({ data: products as never[], skipDuplicates: true });
    count("Product", products.length);

    const packages = rows(exportData, "Package").map((r) => ({ ...r, active: bool(r.active), createdAt: date(r.createdAt)!, updatedAt: date(r.updatedAt)! }));
    await tx.package.createMany({ data: packages as never[], skipDuplicates: true });
    count("Package", packages.length);

    const currencies = rows(exportData, "Currency").map((r) => ({ ...r, active: bool(r.active), createdAt: date(r.createdAt)!, updatedAt: date(r.updatedAt)! }));
    await tx.currency.createMany({ data: currencies as never[], skipDuplicates: true });
    count("Currency", currencies.length);

    await tx.orderNumberSequence.createMany({ data: rows(exportData, "OrderNumberSequence") as never[], skipDuplicates: true });
    count("OrderNumberSequence", rows(exportData, "OrderNumberSequence").length);

    const orders = rows(exportData, "Order").map((r) => ({ ...r, solicitationAt: date(r.solicitationAt)!, paymentDate: date(r.paymentDate), pickupForecast: date(r.pickupForecast), cancelledAt: date(r.cancelledAt), createdAt: date(r.createdAt)!, updatedAt: date(r.updatedAt)! }));
    await tx.order.createMany({ data: orders as never[], skipDuplicates: true });
    count("Order", orders.length);

    const statusHistory = rows(exportData, "OrderStatusHistory").map((r) => ({ ...r, changedAt: date(r.changedAt)! }));
    await tx.orderStatusHistory.createMany({ data: statusHistory as never[], skipDuplicates: true });
    count("OrderStatusHistory", statusHistory.length);

    const changeHistory = rows(exportData, "OrderChangeHistory").map((r) => ({ ...r, changedAt: date(r.changedAt)! }));
    await tx.orderChangeHistory.createMany({ data: changeHistory as never[], skipDuplicates: true });
    count("OrderChangeHistory", changeHistory.length);

    const audit = rows(exportData, "AuditLog").map((r) => ({ ...r, createdAt: date(r.createdAt)! }));
    await tx.auditLog.createMany({ data: audit as never[], skipDuplicates: true });
    count("AuditLog", audit.length);

    const sessions = rows(exportData, "Session").map((r) => ({ ...r, expiresAt: date(r.expiresAt)!, createdAt: date(r.createdAt)! }));
    await tx.session.createMany({ data: sessions as never[], skipDuplicates: true });
    count("Session", sessions.length);

    const challenges = rows(exportData, "LoginChallenge").map((r) => ({ ...r, expiresAt: date(r.expiresAt)!, consumedAt: date(r.consumedAt), createdAt: date(r.createdAt)! }));
    await tx.loginChallenge.createMany({ data: challenges as never[], skipDuplicates: true });
    count("LoginChallenge", challenges.length);

    const settings = rows(exportData, "SystemSetting").map((r) => ({ ...r, createdAt: date(r.createdAt)!, updatedAt: date(r.updatedAt)! }));
    await tx.systemSetting.createMany({ data: settings as never[], skipDuplicates: true });
    count("SystemSetting", settings.length);
  }, { timeout: 60000 });

  console.log("Importação PostgreSQL concluída.");
}

main().finally(async () => prisma.$disconnect());
