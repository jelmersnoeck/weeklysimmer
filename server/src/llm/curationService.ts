import type Database from "better-sqlite3";
import { getSettings } from "../db/seed.js";
import { householdServings, scaleIngredient } from "../domain/portions.js";
import { buildShoppingList } from "../domain/shopping.js";
import type {
  EnabledSlot,
  Meal,
  ShoppingItem,
  WeeklyPlan,
} from "../domain/types.js";
import type { PlanCurator } from "./anthropicClient.js";
import { log } from "../log.js";

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
    caloriesPerServing: m.caloriesPerServing,
    servings,
    ingredients: m.ingredients.map((i) => scaleIngredient(i, servings)),
    steps: m.steps,
    sourceUrl: m.sourceUrl,
    leftoverOf: m.leftoverOf ?? null,
  }));

  const plan: WeeklyPlan = {
    weekStart: input.weekStart,
    onHand: input.onHand,
    note: input.note,
    status: "active",
    meals,
  };

  const shopping = buildShoppingList(meals);

  return { plan, shopping };
}
