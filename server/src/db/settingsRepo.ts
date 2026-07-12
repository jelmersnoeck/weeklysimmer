import type Database from "better-sqlite3";
import type { Settings } from "../domain/types.js";
import { defaultSettings } from "../domain/preferences.js";

/**
 * Does the parsed blob look like a saved v2 profile? Old rows (pre-v2) and
 * anything the user never explicitly saved lack `configured === true`, so they
 * read back as the (unconfigured) default profile — no DB migration needed.
 */
function isConfiguredV2(value: unknown): value is Settings {
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
  if (!isConfiguredV2(parsed)) return defaultSettings();
  return parsed;
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
