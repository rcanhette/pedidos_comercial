import fs from "node:fs";
import path from "node:path";
import { config } from "dotenv";
import { getSqliteDatabasePath } from "./database-path";

config();

function stamp() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

const dbPath = getSqliteDatabasePath();
if (!fs.existsSync(dbPath)) throw new Error(`Banco SQLite não encontrado em ${dbPath}`);

const backupDir = path.resolve(process.cwd(), "backups", "pre-postgresql-migration");
fs.mkdirSync(backupDir, { recursive: true });
const backupPath = path.join(backupDir, `pedidos-sqlite-${stamp()}.db`);
fs.copyFileSync(dbPath, backupPath, fs.constants.COPYFILE_EXCL);
console.log(`Backup SQLite criado com sucesso: ${backupPath}`);
