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

  // A configured v2 row. Merge it OVER the current defaults so any field added after
  // the row was saved (e.g. `units`) is backfilled instead of coming back undefined,
  // while the user's stored values still win. Legacy single-`diet` rows are coerced to
  // `diets` (dropping values no longer in the enum, like `dairy_free`).
  const { diet, diets, ...rest } = parsed as Record<string, unknown>;
  let resolvedDiets: Diet[] = [];
  if (Array.isArray(diets)) {
    resolvedDiets = (diets as Diet[]).filter((d) => DIETS.includes(d));
  } else if (typeof diet === "string" && DIETS.includes(diet as Diet)) {
    resolvedDiets = [diet as Diet];
  }

  return {
    ...defaultSettings(),
    ...(rest as Partial<Settings>),
    diets: resolvedDiets,
    configured: true,
  } as Settings;
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
