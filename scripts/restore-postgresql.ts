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

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: ["ignore", "pipe", "pipe"] });
  if (result.status !== 0) throw new Error(`${command} falhou: ${result.stderr.toString().trim()}`);
  return result.stdout.toString();
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl?.startsWith("postgresql://")) throw new Error("DATABASE_URL deve apontar para PostgreSQL.");
const pgDatabaseUrl = pgToolDatabaseUrl(databaseUrl);
const source = process.argv[2];
if (!source) throw new Error("Informe o arquivo .dump. Exemplo: npm run db:restore -- backups/postgresql/pedidos-YYYY-MM-DD-HHMMSS.dump");
const sourcePath = path.resolve(process.cwd(), source);
if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) throw new Error(`Arquivo inválido: ${sourcePath}`);

console.log("A aplicação deve estar parada antes de restaurar o banco.");
console.log("Criando backup de segurança do estado atual...");
run("tsx", ["scripts/backup-postgresql.ts"]);
run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--dbname", pgDatabaseUrl, sourcePath]);
console.log(`PostgreSQL restaurado a partir de: ${sourcePath}`);
