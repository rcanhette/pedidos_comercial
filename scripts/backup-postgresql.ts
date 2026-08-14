import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { config } from "dotenv";

config();

function pgToolDatabaseUrl(url: string) {
  const parsed = new URL(url);
  parsed.searchParams.delete("schema");
  return parsed.toString();
}

function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("postgresql://")) throw new Error("DATABASE_URL deve apontar para PostgreSQL.");
const pgDatabaseUrl = pgToolDatabaseUrl(databaseUrl);

const backupDir = path.resolve(process.cwd(), "backups", "postgresql");
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `pedidos-${stamp()}.dump`);
const result = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--file", backupPath, pgDatabaseUrl], { stdio: ["ignore", "pipe", "pipe"] });
if (result.status !== 0) {
  fs.rmSync(backupPath, { force: true });
  throw new Error(`pg_dump falhou: ${result.stderr.toString().trim()}`);
}
console.log(`Backup PostgreSQL criado com sucesso: ${backupPath}`);
