import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function openDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  migrate(db);
  return db;
}

/**
 * Idempotent schema migrations for databases created before a column existed.
 * `CREATE TABLE IF NOT EXISTS` does not add columns to a table that already
 * exists, so we ALTER TABLE for any missing columns. Safe to run repeatedly.
 */
function migrate(db: Database.Database): void {
  addColumnIfMissing(db, "meals", "prep_minutes", "INTEGER");
  addColumnIfMissing(db, "meals", "cook_minutes", "INTEGER");
}

function addColumnIfMissing(
  db: Database.Database,
  table: string,
  column: string,
  type: string,
): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
}
