import path from "node:path";

export function getSqliteDatabasePath() {
  const url = process.env.SQLITE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) throw new Error("SQLITE_DATABASE_URL deve usar o formato file: para SQLite.");
  const raw = url.slice("file:".length);
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(process.cwd(), "prisma", raw);
}

export const getDatabasePath = getSqliteDatabasePath;
