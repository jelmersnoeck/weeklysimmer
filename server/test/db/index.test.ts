import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { openDb } from "../../src/db/index.js";

function mealColumns(db: Database.Database): string[] {
  const cols = db.prepare("PRAGMA table_info(meals)").all() as { name: string }[];
  return cols.map((c) => c.name);
}

function planColumns(db: Database.Database): string[] {
  const cols = db
    .prepare("PRAGMA table_info(weekly_plans)")
    .all() as { name: string }[];
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

  it("a fresh db has the calories_per_serving column on meals", () => {
    const db = openDb(":memory:");
    expect(mealColumns(db)).toContain("calories_per_serving");
    db.close();
  });

  it("migration adds calories_per_serving to a pre-existing meals table missing it", () => {
    const path = `/tmp/mealplanner-calories-${Date.now()}.db`;
    const old = new Database(path);
    old.exec(
      `CREATE TABLE meals (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         day INTEGER NOT NULL,
         slot TEXT NOT NULL,
         title TEXT NOT NULL
       )`,
    );
    expect(mealColumns(old)).not.toContain("calories_per_serving");
    old.close();

    const db = openDb(path);
    expect(mealColumns(db)).toContain("calories_per_serving");
    db.close();

    // idempotent: re-running does not duplicate the column
    const db2 = openDb(path);
    expect(
      mealColumns(db2).filter((c) => c === "calories_per_serving"),
    ).toHaveLength(1);
    db2.close();
  });

  it("a fresh db has the on_hand column (not veg_box) on weekly_plans", () => {
    const db = openDb(":memory:");
    const cols = planColumns(db);
    expect(cols).toContain("on_hand");
    expect(cols).not.toContain("veg_box");
    db.close();
  });

  it("migration renames veg_box to on_hand on a pre-existing weekly_plans table", () => {
    // Simulate an OLD database file: weekly_plans still has the veg_box column.
    const path = `/tmp/mealplanner-renamecol-${Date.now()}.db`;
    const old = new Database(path);
    old.exec(
      `CREATE TABLE weekly_plans (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         week_start TEXT NOT NULL,
         veg_box TEXT NOT NULL,
         note TEXT NOT NULL DEFAULT '',
         status TEXT NOT NULL,
         created_at TEXT NOT NULL DEFAULT (datetime('now'))
       )`,
    );
    expect(planColumns(old)).toContain("veg_box");
    expect(planColumns(old)).not.toContain("on_hand");
    old.close();

    // Re-opening through openDb runs the idempotent rename.
    const db = openDb(path);
    expect(planColumns(db)).toContain("on_hand");
    expect(planColumns(db)).not.toContain("veg_box");
    db.close();

    // Running it again is a no-op (idempotent).
    const db2 = openDb(path);
    expect(planColumns(db2)).toContain("on_hand");
    db2.close();
  });
});
