import type { Settings } from "../../src/domain/types.js";
import { defaultSettings } from "../../src/domain/preferences.js";

/**
 * A valid, CONFIGURED v2 Settings object for tests. Starts from `defaultSettings()`
 * (so every canonical field is present and internally consistent) and flips
 * `configured` to true. Pass `overrides` to tweak individual fields per test.
 */
export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return { ...defaultSettings(), configured: true, ...overrides };
}
