import type Database from "better-sqlite3";
import type { Settings } from "../domain/types.js";

const DEFAULT_SETTINGS: Settings = {
  members: [
    { label: "Adult A", consumptionFactor: 1.15 },
    { label: "Adult B", consumptionFactor: 1.15 },
    { label: "Toddler", consumptionFactor: 0.5 },
  ],
  restrictions: ["no_spicy", "low_fodmap"],
  avoidIngredients: ["beans", "lentils", "onion", "garlic"],
  proteinCadence: { veg_per_week: 1, red_or_high_fat_per_week: 1 },
  effort: "easy",
  defaultVegQuantities: {
    carrot: { quantity: 300, unit: "g" },
    leek: { quantity: 2, unit: "piece" },
    spinach: { quantity: 200, unit: "g" },
    courgette: { quantity: 2, unit: "piece" },
    bell_pepper: { quantity: 2, unit: "piece" },
    broccoli: { quantity: 1, unit: "piece" },
    tomato: { quantity: 400, unit: "g" },
  },
};

export function seedSettings(db: Database.Database): void {
  db.prepare("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)").run(
    JSON.stringify(DEFAULT_SETTINGS)
  );
}

export function getSettings(db: Database.Database): Settings {
  const row = db.prepare("SELECT data FROM settings WHERE id = 1").get() as
    | { data: string }
    | undefined;
  if (!row) {
    throw new Error("settings not seeded");
  }
  return JSON.parse(row.data) as Settings;
}
