import type Database from "better-sqlite3";
import { getSettings } from "../db/settingsRepo.js";
import { householdServings, scaleIngredient } from "../domain/portions.js";
import { buildShoppingList, excludeOnHand } from "../domain/shopping.js";
import type {
  EnabledSlot,
  Meal,
  ShoppingItem,
  WeeklyPlan,
} from "../domain/types.js";
import type { PlanCurator } from "./anthropicClient.js";
import type { RawMeal } from "./planSchema.js";
import { consolidateShopping } from "./consolidation.js";
import { log } from "../log.js";

/**
 * Turn a raw (per-single-serving) meal from the LLM into a stored household Meal:
 * scale each ingredient to `servings` and stamp the serving count. Shared by initial
 * generation, single-meal regeneration and mid-week adjustment so the scaling rule
 * lives in exactly one place.
 */
export function scaleRawMeal(raw: RawMeal, servings: number): Meal {
  return {
    day: raw.day,
    slot: raw.slot,
    title: raw.title,
    cuisine: raw.cuisine,
    proteinClass: raw.proteinClass,
    base: raw.base,
    difficulty: raw.difficulty,
    prepMinutes: raw.prepMinutes,
    cookMinutes: raw.cookMinutes,
    caloriesPerServing: raw.caloriesPerServing,
    servings,
    ingredients: raw.ingredients.map((i) => scaleIngredient(i, servings)),
    steps: raw.steps,
    sourceUrl: raw.sourceUrl,
    leftoverOf: raw.leftoverOf ?? null,
  };
}

export interface GeneratePlanInput {
  weekStart: string;
  onHand: string[];
  note: string;
  avoid: string[];
  enabledSlots: EnabledSlot[];
}

export interface GeneratePlanResult {
  plan: WeeklyPlan;
  shopping: ShoppingItem[];
}

/**
 * Curate a weekly plan: ask the LLM for raw recipes, then let deterministic code
 * scale portions to household quantities and derive the shopping list.
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

  log(
    "llm",
    `requesting ${input.enabledSlots.length}-meal plan from Claude (web search)…`,
  );
  const llmStart = Date.now();
  const raw = await curator.curate({ settings, ...input });
  const llmSecs = ((Date.now() - llmStart) / 1000).toFixed(1);
  log("llm", `Claude returned ${raw.meals.length} meals in ${llmSecs}s`);

  // Two meals sharing a (day, slot) corrupt the shopping list and the UI only
  // shows the first — reject rather than silently drop one. (A slightly short
  // week is fine: it renders as gaps, so we do NOT enforce a full 35-meal count.)
  const seen = new Set<string>();
  for (const m of raw.meals) {
    const key = `${m.day}:${m.slot}`;
    if (seen.has(key)) {
      throw new Error("LLM returned duplicate meals for the same day and slot");
    }
    seen.add(key);
  }

  const servings = householdServings(settings.household);

  const meals: Meal[] = raw.meals.map((m) => scaleRawMeal(m, servings));

  const plan: WeeklyPlan = {
    weekStart: input.weekStart,
    onHand: input.onHand,
    note: input.note,
    status: "active",
    meals,
  };

  const rawShopping = buildShoppingList(meals);
  // LLM consolidation review: fold same-product lines together (falls back to the
  // un-consolidated list if the review fails — never breaks generation).
  const consolidated = await consolidateShopping(curator, rawShopping);
  // Drop anything the household already has on hand — those aren't things to buy.
  const { toBuy } = excludeOnHand(consolidated, input.onHand);

  return { plan, shopping: toBuy };
}
