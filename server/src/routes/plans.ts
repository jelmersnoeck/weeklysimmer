import { Router } from "express";
import type Database from "better-sqlite3";
import { getSettings } from "../db/settingsRepo.js";
import {
  savePlan,
  getPlan,
  listPlans,
  rateMeal,
  updateMeal,
  saveShoppingItems,
  getShoppingItems,
} from "../db/plansRepo.js";
import { householdServings, scaleIngredient } from "../domain/portions.js";
import { buildShoppingList } from "../domain/shopping.js";
import {
  SLOTS,
  enabledSlotsFromSchedule,
} from "../domain/schedule.js";
import type { EnabledSlot, Meal, Slot } from "../domain/types.js";
import type { RawMeal } from "../llm/planSchema.js";
import type { PlanCurator } from "../llm/anthropicClient.js";
import { consolidateShopping } from "../llm/consolidation.js";
import type { JobStore } from "../jobs/registry.js";
import { enqueueGeneration } from "../jobs/generation.js";

/** An error carrying an HTTP status the error middleware turns into `{ error }`. */
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Scale a raw (per-serving) meal up to household quantities. */
function scaleRawMeal(raw: RawMeal, servings: number): Meal {
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

/** Routes for weekly plans, meal ratings and single-meal regeneration. */
export function plansRouter(
  db: Database.Database,
  deps: { curator: PlanCurator; store: JobStore }
): Router {
  const router = Router();

  // Kick off generation of a new weekly plan as a background job. Validation is
  // synchronous (400 on bad input, before any job is created); the actual
  // curation/persistence runs asynchronously so the client isn't held for
  // minutes. Returns 202 with the job id to poll via GET /api/jobs/:id.
  router.post("/plans/generate", (req, res) => {
    // Onboarding guard: refuse to plan a week until the user has configured their
    // preferences (the frontend also gates this, but enforce it server-side too).
    if (getSettings(db).configured === false) {
      throw new HttpError(
        409,
        "Configure your preferences before planning a week.",
      );
    }

    const { weekStart, onHand, note, avoid, enabledSlots } = req.body ?? {};
    if (typeof weekStart !== "string" || weekStart.length === 0) {
      throw new HttpError(400, "weekStart must be a non-empty string");
    }
    if (!Array.isArray(onHand)) {
      throw new HttpError(400, "onHand must be an array");
    }
    if (!onHand.every((v) => typeof v === "string")) {
      throw new HttpError(400, "onHand entries must all be strings");
    }

    // enabledSlots is optional: when omitted, derive it from the user's default
    // meal schedule; when provided, validate every entry.
    const validSlots = new Set<string>(SLOTS);
    let slots: EnabledSlot[];
    if (enabledSlots === undefined) {
      slots = enabledSlotsFromSchedule(getSettings(db).mealSchedule);
    } else {
      if (!Array.isArray(enabledSlots)) {
        throw new HttpError(400, "enabledSlots must be an array");
      }
      for (const e of enabledSlots) {
        if (
          typeof e !== "object" ||
          e === null ||
          !Number.isInteger(e.day) ||
          e.day < 0 ||
          e.day > 6 ||
          !validSlots.has(e.slot)
        ) {
          throw new HttpError(
            400,
            "each enabledSlots entry needs a day 0-6 and a valid slot",
          );
        }
      }
      slots = enabledSlots.map((e: { day: number; slot: Slot }) => ({
        day: e.day,
        slot: e.slot,
      }));
    }

    const { jobId } = enqueueGeneration(
      { db, curator: deps.curator, store: deps.store },
      {
        weekStart,
        onHand,
        note: typeof note === "string" ? note : "",
        avoid: Array.isArray(avoid) ? avoid : [],
        enabledSlots: slots,
      },
    );

    res.status(202).json({ jobId });
  });

  // List plan summaries, newest first.
  router.get("/plans", (_req, res) => {
    res.json(listPlans(db));
  });

  // Fetch a single plan with its shopping list.
  router.get("/plans/:id", (req, res) => {
    const id = Number(req.params.id);
    const plan = getPlan(db, id);
    if (!plan) {
      throw new HttpError(404, "plan not found");
    }
    res.json({
      plan,
      shopping: getShoppingItems(db, id),
    });
  });

  // Rate a meal 1-5.
  router.post("/meals/:mealId/rate", (req, res) => {
    const mealId = Number(req.params.mealId);
    if (Number.isNaN(mealId)) {
      throw new HttpError(400, "mealId must be a number");
    }
    const { rating } = req.body ?? {};
    if (
      typeof rating !== "number" ||
      !Number.isFinite(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      throw new HttpError(400, "rating must be a number between 1 and 5");
    }
    if (rateMeal(db, mealId, rating) === 0) {
      throw new HttpError(404, "meal not found");
    }
    res.json({ ok: true });
  });

  // Regenerate a single meal in an existing plan and re-aggregate the shopping list.
  router.post("/plans/:id/meals/:mealId/regenerate", async (req, res) => {
    const id = Number(req.params.id);
    const mealId = Number(req.params.mealId);

    const plan = getPlan(db, id);
    if (!plan) {
      throw new HttpError(404, "plan not found");
    }
    const target = plan.meals.find((m) => m.id === mealId);
    if (!target) {
      throw new HttpError(404, "meal not found in plan");
    }

    const settings = getSettings(db);
    const rawMeal = await deps.curator.regenerateMeal({
      settings,
      day: target.day,
      slot: target.slot,
      proteinClass: target.proteinClass,
      onHand: plan.onHand,
      note: plan.note,
      otherMeals: plan.meals.filter((m) => m.id !== mealId),
    });

    const servings = householdServings(settings.household);
    updateMeal(db, mealId, scaleRawMeal(rawMeal, servings));

    const updated = getPlan(db, id)!;
    const rawShopping = buildShoppingList(updated.meals);
    const shopping = await consolidateShopping(deps.curator, rawShopping);
    saveShoppingItems(db, id, shopping);

    res.json({
      plan: updated,
      shopping,
    });
  });

  return router;
}
