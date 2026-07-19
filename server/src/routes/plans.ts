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
  listSnapshots,
} from "../db/plansRepo.js";
import { householdServings } from "../domain/portions.js";
import { buildShoppingList, excludeOnHand } from "../domain/shopping.js";
import {
  SLOTS,
  enabledSlotsFromSchedule,
} from "../domain/schedule.js";
import type { EnabledSlot, Slot } from "../domain/types.js";
import type { AdjustScope } from "../domain/adjust.js";
import type { PlanCurator } from "../llm/anthropicClient.js";
import { scaleRawMeal } from "../llm/curationService.js";
import { consolidateShopping } from "../llm/consolidation.js";
import type { JobStore } from "../jobs/registry.js";
import { enqueueGeneration } from "../jobs/generation.js";
import { enqueueAdjustment } from "../jobs/adjustment.js";

/** An error carrying an HTTP status the error middleware turns into `{ error }`. */
class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Validate the adjust request's `scope` and narrow it to a typed AdjustScope, or throw
 * a 400. `from` needs a valid (day, slot) cut-off; `days` needs a non-empty list of
 * day indices 0-6.
 */
function parseScope(scope: unknown): AdjustScope {
  if (typeof scope !== "object" || scope === null) {
    throw new HttpError(400, "scope must be an object");
  }
  const s = scope as Record<string, unknown>;
  if (s.kind === "from") {
    if (!Number.isInteger(s.day) || (s.day as number) < 0 || (s.day as number) > 6) {
      throw new HttpError(400, "scope.day must be an integer 0-6");
    }
    if (typeof s.slot !== "string" || !SLOTS.includes(s.slot as Slot)) {
      throw new HttpError(400, "scope.slot must be a valid slot");
    }
    return { kind: "from", day: s.day as number, slot: s.slot as Slot };
  }
  if (s.kind === "days") {
    const days = s.days;
    if (
      !Array.isArray(days) ||
      days.length === 0 ||
      !days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    ) {
      throw new HttpError(400, "scope.days must be a non-empty array of day indices 0-6");
    }
    return { kind: "days", days: days as number[] };
  }
  throw new HttpError(400, "scope.kind must be 'from' or 'days'");
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
    const consolidated = await consolidateShopping(deps.curator, rawShopping);
    // Exclude foods the household already has on hand from the buy list.
    const { toBuy: shopping } = excludeOnHand(consolidated, updated.onHand);
    saveShoppingItems(db, id, shopping);

    res.json({
      plan: updated,
      shopping,
    });
  });

  // Adjust the still-to-come portion of the current week from a directional note.
  // Validation is synchronous (400/404/409); the LLM change-set + shopping diff run
  // as a background job. Returns 202 with the job id to poll via GET /api/jobs/:id.
  router.post("/plans/:id/adjust", (req, res) => {
    const id = Number(req.params.id);
    const plan = getPlan(db, id);
    if (!plan) {
      throw new HttpError(404, "plan not found");
    }
    if (plan.status !== "active") {
      throw new HttpError(409, "only the active week can be adjusted");
    }

    const { note, scope } = req.body ?? {};

    const { jobId } = enqueueAdjustment(
      { db, curator: deps.curator, store: deps.store },
      {
        planId: id,
        weekStart: plan.weekStart,
        note: typeof note === "string" ? note : "",
        scope: parseScope(scope),
      },
    );

    res.status(202).json({ jobId });
  });

  // List the pre-adjustment snapshots saved for a plan (newest first).
  router.get("/plans/:id/snapshots", (req, res) => {
    const id = Number(req.params.id);
    if (!getPlan(db, id)) {
      throw new HttpError(404, "plan not found");
    }
    res.json(listSnapshots(db, id));
  });

  return router;
}
