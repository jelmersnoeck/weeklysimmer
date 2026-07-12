import type Database from "better-sqlite3";
import type { Diet, Settings } from "../domain/types.js";
import { DIETS, defaultSettings } from "../domain/preferences.js";

/**
 * Does the parsed blob have the shared v2 backbone (configured + household +
 * proteins + mealSchedule)? Old rows (pre-v2) and anything the user never
 * explicitly saved lack `configured === true`, so they read back as the
 * (unconfigured) default profile — no DB migration needed. The diet shape is
 * checked separately so we can migrate an old single-`diet` row to `diets`.
 */
function isV2Backbone(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.configured === true &&
    Array.isArray(v.household) &&
    Array.isArray(v.proteins) &&
    typeof v.mealSchedule === "object" &&
    v.mealSchedule !== null
  );
}

/**
 * Read household settings. Returns a synthesized default profile (configured:false)
 * when there is no row, an old-shape row, or an unconfigured blob — so the app always
 * has settings to show, but generation stays gated until the user saves their own.
 *
 * A v2 row that predates multi-select diets stores a single `diet` string instead of
 * a `diets` array; we coerce it to `diets: [diet]` filtered to the current enum
 * (dropping removed values like `dairy_free`, which are now avoid concerns).
 */
export function getSettings(db: Database.Database): Settings {
  const row = db.prepare("SELECT data FROM settings WHERE id = 1").get() as
    | { data: string }
    | undefined;
  if (!row) return defaultSettings();

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.data);
  } catch {
    return defaultSettings();
  }
  if (!isV2Backbone(parsed)) return defaultSettings();

  // Already the new (multi-select) shape — return verbatim.
  if (Array.isArray(parsed.diets)) return parsed as unknown as Settings;

  // Old single-`diet` row: migrate to `diets`, dropping any value not in the new enum.
  if (typeof parsed.diet === "string") {
    const { diet, ...rest } = parsed;
    const diets = DIETS.includes(diet as Diet) ? [diet as Diet] : [];
    return { ...(rest as unknown as Settings), diets };
  }

  return defaultSettings();
}

/**
 * Persist the user's preferences as the single settings row (id=1), forcing
 * `configured: true`. Returns the exact object that was stored.
 */
export function saveSettings(db: Database.Database, settings: Settings): Settings {
  const toStore: Settings = { ...settings, configured: true };
  db.prepare("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)").run(
    JSON.stringify(toStore),
  );
  return toStore;
}
