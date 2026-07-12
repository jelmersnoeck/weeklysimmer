import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { openDb } from "../../src/db/index.js";

function mealColumns(db: Database.Database): string[] {
  const cols = db.prepare("PRAGMA table_info(meals)").all() as { name: string }[];
  return cols.map((c) => c.name);
}

describe("openDb", () => {
  it("creates the expected tables", () => {
    const db = openDb(":memory:");
    const rows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      )
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    expect(names).toContain("settings");
    expect(names).toContain("weekly_plans");
    expect(names).toContain("meals");
    expect(names).toContain("shopping_items");
    db.close();
  });

  it("enables foreign key enforcement", () => {
    const db = openDb(":memory:");
    const fk = db.prepare("PRAGMA foreign_keys").get() as {
      foreign_keys: number;
    };
    expect(fk.foreign_keys).toBe(1);
    db.close();
  });

  it("a fresh db has prep_minutes and cook_minutes columns on meals", () => {
    const db = openDb(":memory:");
    const cols = mealColumns(db);
    expect(cols).toContain("prep_minutes");
    expect(cols).toContain("cook_minutes");
    db.close();
  });

  it("migration adds the time columns to a pre-existing meals table missing them", () => {
    // Simulate an OLD database file: a meals table without the new columns.
    const path = `/tmp/mealplanner-migrate-${Date.now()}.db`;
    const old = new Database(path);
    old.exec(
      `CREATE TABLE meals (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         day INTEGER NOT NULL,
         slot TEXT NOT NULL,
         title TEXT NOT NULL
       )`,
    );
    expect(mealColumns(old)).not.toContain("prep_minutes");
    expect(mealColumns(old)).not.toContain("cook_minutes");
    old.close();

    // Re-opening through openDb runs the idempotent migration.
    const db = openDb(path);
    expect(mealColumns(db)).toContain("prep_minutes");
    expect(mealColumns(db)).toContain("cook_minutes");
    db.close();

    // Running it again is a no-op (idempotent) — must not throw or duplicate.
    const db2 = openDb(path);
    const cols = mealColumns(db2);
    expect(cols.filter((c) => c === "prep_minutes")).toHaveLength(1);
    expect(cols.filter((c) => c === "cook_minutes")).toHaveLength(1);
    db2.close();
  });
});
