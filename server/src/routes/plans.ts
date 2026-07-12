import { Router } from "express";
import type Database from "better-sqlite3";
import { getSettings } from "../db/seed.js";
import {
  savePlan,
  getPlan,
  listPlans,
  rateMeal,
  updateMeal,
  saveShoppingItems,
  getShoppingItems,
} from "../db/plansRepo.js";
import { generatePlan } from "../llm/curationService.js";
import { householdServings, scaleIngredient } from "../domain/portions.js";
import { buildShoppingList } from "../domain/shopping.js";
import { unusedVegetables } from "../domain/coverage.js";
import type { Meal } from "../domain/types.js";
import type { RawMeal } from "../llm/planSchema.js";
import type { PlanCurator } from "../llm/anthropicClient.js";

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
  deps: { curator: PlanCurator }
): Router {
  const router = Router();

  // Generate + persist a new weekly plan.
  router.post("/plans/generate", async (req, res) => {
    const { weekStart, vegBox, note, avoid } = req.body ?? {};
    if (typeof weekStart !== "string" || weekStart.length === 0) {
      throw new HttpError(400, "weekStart must be a non-empty string");
    }
    if (!Array.isArray(vegBox)) {
      throw new HttpError(400, "vegBox must be an array");
    }
    if (!vegBox.every((v) => typeof v === "string")) {
      throw new HttpError(400, "vegBox entries must all be strings");
    }

    const { plan, shopping, unusedVeg } = await generatePlan(db, deps.curator, {
      weekStart,
      vegBox,
      note: typeof note === "string" ? note : "",
      avoid: Array.isArray(avoid) ? avoid : [],
    });

    const id = savePlan(db, plan);
    saveShoppingItems(db, id, shopping);

    res.status(201).json({ planId: id, plan: getPlan(db, id), shopping, unusedVeg });
  });

  // List plan summaries, newest first.
  router.get("/plans", (_req, res) => {
    res.json(listPlans(db));
  });

  // Fetch a single plan with its shopping list and recomputed unused veg.
  router.get("/plans/:id", (req, res) => {
    const id = Number(req.params.id);
    const plan = getPlan(db, id);
    if (!plan) {
      throw new HttpError(404, "plan not found");
    }
    res.json({
      plan,
      shopping: getShoppingItems(db, id),
      unusedVeg: unusedVegetables(plan.vegBox, plan.meals),
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
      vegBox: plan.vegBox,
      note: plan.note,
      otherMeals: plan.meals.filter((m) => m.id !== mealId),
    });

    const servings = householdServings(settings.members);
    updateMeal(db, mealId, scaleRawMeal(rawMeal, servings));

    const updated = getPlan(db, id)!;
    const shopping = buildShoppingList(updated.meals);
    saveShoppingItems(db, id, shopping);

    res.json({
      plan: updated,
      shopping,
      unusedVeg: unusedVegetables(updated.vegBox, updated.meals),
    });
  });

  return router;
}
