import { describe, it, expect } from "vitest";
import { openDb } from "../../src/db/index.js";
import { getSettings, saveSettings } from "../../src/db/settingsRepo.js";
import { defaultSettings } from "../../src/domain/preferences.js";
import { makeSettings } from "../helpers/settings.js";

describe("getSettings", () => {
  it("synthesizes an unconfigured default profile when there is no row", () => {
    const db = openDb(":memory:");
    const settings = getSettings(db);
    expect(settings.configured).toBe(false);
    expect(settings).toEqual(defaultSettings());
    // no row was written just by reading
    const count = db.prepare("SELECT COUNT(*) AS n FROM settings").get() as {
      n: number;
    };
    expect(count.n).toBe(0);
    db.close();
  });

  it("reads an OLD (pre-v2) settings row as unconfigured defaults", () => {
    const db = openDb(":memory:");
    db.prepare("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)").run(
      JSON.stringify({
        members: [{ label: "Adult", consumptionFactor: 1.15 }],
        restrictions: ["no_spicy"],
        avoidIngredients: [],
        proteinCadence: { veg_per_week: 1, red_or_high_fat_per_week: 1 },
        effort: "easy",
        defaultVegQuantities: {},
      }),
    );

    const settings = getSettings(db);
    expect(settings.configured).toBe(false);
    expect(settings).toEqual(defaultSettings());
    db.close();
  });

  it("returns a saved v2 profile verbatim", () => {
    const db = openDb(":memory:");
    const saved = saveSettings(db, makeSettings({ diets: ["vegetarian"] }));
    const settings = getSettings(db);
    expect(settings.configured).toBe(true);
    expect(settings.diets).toEqual(["vegetarian"]);
    expect(settings).toEqual(saved);
    db.close();
  });

  it("migrates an old single-`diet` v2 row to the `diets` array", () => {
    const db = openDb(":memory:");
    const { diets, ...rest } = makeSettings();
    db.prepare("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)").run(
      JSON.stringify({ ...rest, diet: "vegetarian" }),
    );
    const settings = getSettings(db);
    expect(settings.configured).toBe(true);
    expect(settings.diets).toEqual(["vegetarian"]);
    expect((settings as unknown as { diet?: unknown }).diet).toBeUndefined();
    db.close();
  });

  it("drops a removed diet value when migrating an old `diet` row", () => {
    const db = openDb(":memory:");
    const { diets, ...rest } = makeSettings();
    db.prepare("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)").run(
      JSON.stringify({ ...rest, diet: "dairy_free" }),
    );
    const settings = getSettings(db);
    // dairy_free is no longer a diet (it's an avoid concern), so it drops to no framework
    expect(settings.diets).toEqual([]);
    db.close();
  });
});

describe("saveSettings", () => {
  it("upserts a single row and forces configured:true", () => {
    const db = openDb(":memory:");
    const saved = saveSettings(db, makeSettings({ configured: false }));
    expect(saved.configured).toBe(true);

    const count = db.prepare("SELECT COUNT(*) AS n FROM settings").get() as {
      n: number;
    };
    expect(count.n).toBe(1);

    // upsert again keeps a single row
    saveSettings(db, makeSettings());
    const count2 = db.prepare("SELECT COUNT(*) AS n FROM settings").get() as {
      n: number;
    };
    expect(count2.n).toBe(1);
    db.close();
  });
});
