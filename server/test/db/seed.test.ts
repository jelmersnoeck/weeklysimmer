import { describe, it, expect } from "vitest";
import { openDb } from "../../src/db/index.js";
import { seedSettings, getSettings } from "../../src/db/seed.js";

describe("seedSettings", () => {
  it("seeds exactly one settings row with the household profile", () => {
    const db = openDb(":memory:");
    seedSettings(db);

    const count = db.prepare("SELECT COUNT(*) AS n FROM settings").get() as {
      n: number;
    };
    expect(count.n).toBe(1);

    const settings = getSettings(db);
    expect(settings.members).toEqual([
      { label: "Adult A", consumptionFactor: 1.15 },
      { label: "Adult B", consumptionFactor: 1.15 },
      { label: "Toddler", consumptionFactor: 0.5 },
    ]);
    expect(settings.restrictions).toEqual(["no_spicy", "low_fodmap"]);
    expect(settings.avoidIngredients).toContain("beans");
    expect(settings.proteinCadence).toEqual({
      veg_per_week: 1,
      red_or_high_fat_per_week: 1,
    });
    expect(settings.effort).toBe("easy");
    expect(Object.keys(settings.defaultVegQuantities).length).toBeGreaterThan(0);
    db.close();
  });

  it("is idempotent and keeps a single row", () => {
    const db = openDb(":memory:");
    seedSettings(db);
    seedSettings(db);
    const count = db.prepare("SELECT COUNT(*) AS n FROM settings").get() as {
      n: number;
    };
    expect(count.n).toBe(1);
    db.close();
  });
});
