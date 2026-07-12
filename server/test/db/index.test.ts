import { describe, it, expect } from "vitest";
import { openDb } from "../../src/db/index.js";

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
});
