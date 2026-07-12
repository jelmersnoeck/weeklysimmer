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

    // mealSchedule seeded with all 35 cells true (5 slots x 7 days)
    const slots = Object.values(settings.mealSchedule);
    expect(slots).toHaveLength(5);
    for (const week of slots) {
      expect(week).toHaveLength(7);
      expect(week.every((cell) => cell === true)).toBe(true);
    }
    db.close();
  });

  it("defaults mealSchedule to all-true for an old settings row that lacks it", () => {
    const db = openDb(":memory:");
    // simulate an OLD seeded row: settings JSON without mealSchedule
    db.prepare("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)").run(
      JSON.stringify({
        members: [{ label: "Adult", consumptionFactor: 1.15 }],
        restrictions: [],
        avoidIngredients: [],
        proteinCadence: { veg_per_week: 1, red_or_high_fat_per_week: 1 },
        effort: "easy",
        defaultVegQuantities: {},
      }),
    );

    const settings = getSettings(db);
    expect(settings.mealSchedule).toBeDefined();
    expect(Object.keys(settings.mealSchedule)).toHaveLength(5);
    expect(settings.mealSchedule.breakfast).toEqual([
      true, true, true, true, true, true, true,
    ]);
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
