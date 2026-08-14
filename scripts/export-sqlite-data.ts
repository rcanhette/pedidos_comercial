import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { config } from "dotenv";
import { getSqliteDatabasePath } from "./database-path";

config();

const tables = [
  "User",
  "LoginChallenge",
  "Session",
  "Role",
  "Permission",
  "UserRole",
  "RolePermission",
  "UserPermission",
  "Product",
  "Package",
  "Currency",
  "OrderNumberSequence",
  "Order",
  "OrderStatusHistory",
  "OrderChangeHistory",
  "AuditLog",
  "SystemSetting"
];

function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

const dbPath = getSqliteDatabasePath();
if (!fs.existsSync(dbPath)) throw new Error(`Banco SQLite não encontrado em ${dbPath}`);

const outputArg = process.argv[2];
const outputDir = path.resolve(process.cwd(), "backups", "pre-postgresql-migration");
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = outputArg ? path.resolve(process.cwd(), outputArg) : path.join(outputDir, `sqlite-export-${stamp()}.json`);

const db = new DatabaseSync(dbPath, { readOnly: true });
const data: Record<string, unknown[]> = {};
const counts: Record<string, number> = {};

for (const table of tables) {
  const rows = db.prepare(`SELECT * FROM "${table}"`).all() as unknown[];
  data[table] = rows;
  counts[table] = rows.length;
}

const payload = {
  metadata: {
    source: dbPath,
    exportedAt: new Date().toISOString(),
    tables
  },
  counts,
  data
};
const canonical = JSON.stringify(payload);
const sha256 = createHash("sha256").update(canonical).digest("hex");
const finalPayload = { ...payload, metadata: { ...payload.metadata, sha256 } };
fs.writeFileSync(outputPath, JSON.stringify(finalPayload, null, 2));

console.log(`Exportação SQLite criada: ${outputPath}`);
for (const [table, count] of Object.entries(counts)) console.log(`${table}: ${count}`);
console.log(`sha256: ${sha256}`);
db.close();
