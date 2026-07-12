import { randomUUID } from "node:crypto";
import type {
  Appetite,
  Diet,
  Difficulty,
  Frequency,
  HouseholdMember,
  MealSchedule,
  MemberType,
  ProteinPref,
  Settings,
  Slot,
} from "./types.js";
import { APPETITES, DIETS, FREQUENCIES, MEMBER_TYPES } from "./preferences.js";
import { SLOTS } from "./schedule.js";

export type ValidationResult =
  | { ok: true; settings: Settings }
  | { ok: false; error: string };

const EFFORTS: readonly Difficulty[] = ["easy", "medium", "hard"];

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function validateMealSchedule(v: unknown): MealSchedule | null {
  if (typeof v !== "object" || v === null) return null;
  const obj = v as Record<string, unknown>;
  const out = {} as MealSchedule;
  for (const slot of SLOTS) {
    const week = obj[slot];
    if (
      !Array.isArray(week) ||
      week.length !== 7 ||
      !week.every((c) => typeof c === "boolean")
    ) {
      return null;
    }
    out[slot as Slot] = week as boolean[];
  }
  return out;
}

/**
 * Validate and normalize a PUT /api/settings body into a Settings object.
 *
 * Members without an id get one generated. `configured` is intentionally NOT read
 * from the body — saveSettings forces it true. Returns a discriminated union so the
 * route can answer 400 `{error}` or 200 with the clean settings.
 */
export function validateSettings(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "settings body must be an object" };
  }
  const b = body as Record<string, unknown>;

  // household: non-empty array of valid members
  if (!Array.isArray(b.household) || b.household.length === 0) {
    return { ok: false, error: "household must be a non-empty array" };
  }
  const household: HouseholdMember[] = [];
  for (const m of b.household) {
    if (typeof m !== "object" || m === null) {
      return { ok: false, error: "each household member must be an object" };
    }
    const mem = m as Record<string, unknown>;
    if (!MEMBER_TYPES.includes(mem.type as MemberType)) {
      return { ok: false, error: "each member needs a valid type (adult|child)" };
    }
    if (!APPETITES.includes(mem.appetite as Appetite)) {
      return { ok: false, error: "each member needs a valid appetite" };
    }
    if (mem.id !== undefined && typeof mem.id !== "string") {
      return { ok: false, error: "member id must be a string" };
    }
    if (mem.name !== undefined && typeof mem.name !== "string") {
      return { ok: false, error: "member name must be a string" };
    }
    household.push({
      id: typeof mem.id === "string" && mem.id.length > 0 ? mem.id : randomUUID(),
      ...(typeof mem.name === "string" ? { name: mem.name } : {}),
      type: mem.type as MemberType,
      appetite: mem.appetite as Appetite,
    });
  }

  // proteins: array of { key, frequency }
  if (!Array.isArray(b.proteins)) {
    return { ok: false, error: "proteins must be an array" };
  }
  const proteins: ProteinPref[] = [];
  for (const p of b.proteins) {
    if (typeof p !== "object" || p === null) {
      return { ok: false, error: "each protein must be an object" };
    }
    const pr = p as Record<string, unknown>;
    if (typeof pr.key !== "string") {
      return { ok: false, error: "each protein needs a string key" };
    }
    if (!FREQUENCIES.includes(pr.frequency as Frequency)) {
      return { ok: false, error: `invalid frequency for protein ${pr.key}` };
    }
    proteins.push({ key: pr.key, frequency: pr.frequency as Frequency });
  }

  // string-array preference lists
  const listFields = [
    "vegetablesLiked",
    "fruitsLiked",
    "cuisinesLiked",
    "dishTypesLiked",
    "flavoursLiked",
    "avoid",
  ] as const;
  for (const field of listFields) {
    if (!isStringArray(b[field])) {
      return { ok: false, error: `${field} must be an array of strings` };
    }
  }

  if (
    !Array.isArray(b.diets) ||
    !b.diets.every((d) => DIETS.includes(d as Diet))
  ) {
    return { ok: false, error: "diets must be an array of valid diets" };
  }
  if (!EFFORTS.includes(b.effort as Difficulty)) {
    return { ok: false, error: "effort must be easy, medium or hard" };
  }

  const mealSchedule = validateMealSchedule(b.mealSchedule);
  if (!mealSchedule) {
    return {
      ok: false,
      error: "mealSchedule must map each slot to 7 booleans",
    };
  }

  return {
    ok: true,
    settings: {
      configured: true,
      household,
      proteins,
      vegetablesLiked: b.vegetablesLiked as string[],
      fruitsLiked: b.fruitsLiked as string[],
      cuisinesLiked: b.cuisinesLiked as string[],
      dishTypesLiked: b.dishTypesLiked as string[],
      flavoursLiked: b.flavoursLiked as string[],
      avoid: b.avoid as string[],
      diets: b.diets as Diet[],
      effort: b.effort as Difficulty,
      mealSchedule,
    },
  };
}
