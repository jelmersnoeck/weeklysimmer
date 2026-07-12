import type Database from "better-sqlite3";
import { getSettings } from "../db/seed.js";
import { householdServings, scaleIngredient } from "../domain/portions.js";
import { buildShoppingList } from "../domain/shopping.js";
import { unusedVegetables } from "../domain/coverage.js";
import type { Meal, ShoppingItem, WeeklyPlan } from "../domain/types.js";
import type { PlanCurator } from "./anthropicClient.js";

export interface GeneratePlanInput {
  weekStart: string;
  vegBox: string[];
  note: string;
  avoid: string[];
}

export interface GeneratePlanResult {
  plan: WeeklyPlan;
  shopping: ShoppingItem[];
  unusedVeg: string[];
}

/**
 * Curate a weekly plan: ask the LLM for raw recipes, then let deterministic code
 * scale portions to household quantities and derive the shopping list + veg coverage.
 *
 * Meals STORE portion-scaled (household) quantities. Does NOT persist — routes will
 * persist in a later phase.
 */
export async function generatePlan(
  db: Database.Database,
  curator: PlanCurator,
  input: GeneratePlanInput,
): Promise<GeneratePlanResult> {
  const settings = getSettings(db);
  const raw = await curator.curate({ settings, ...input });

  // Two meals sharing a (day, slot) corrupt the shopping list and the UI only
  // shows the first — reject rather than silently drop one. (A slightly short
  // week is fine: it renders as gaps, so we do NOT enforce a full 21-meal count.)
  const seen = new Set<string>();
  for (const m of raw.meals) {
    const key = `${m.day}:${m.slot}`;
    if (seen.has(key)) {
      throw new Error("LLM returned duplicate meals for the same day and slot");
    }
    seen.add(key);
  }

  const servings = householdServings(settings.members);

  const meals: Meal[] = raw.meals.map((m) => ({
    day: m.day,
    slot: m.slot,
    title: m.title,
    cuisine: m.cuisine,
    proteinClass: m.proteinClass,
    base: m.base,
    difficulty: m.difficulty,
    prepMinutes: m.prepMinutes,
    cookMinutes: m.cookMinutes,
    servings,
    ingredients: m.ingredients.map((i) => scaleIngredient(i, servings)),
    steps: m.steps,
    sourceUrl: m.sourceUrl,
    leftoverOf: m.leftoverOf ?? null,
  }));

  const plan: WeeklyPlan = {
    weekStart: input.weekStart,
    vegBox: input.vegBox,
    note: input.note,
    status: "active",
    meals,
  };

  const shopping = buildShoppingList(meals);
  const unusedVeg = unusedVegetables(input.vegBox, meals);

  return { plan, shopping, unusedVeg };
}
