import type Database from "better-sqlite3";
import type { PlanCurator } from "../llm/anthropicClient.js";
import type { JobStore } from "./registry.js";
import type { Meal } from "../domain/types.js";
import {
  getPlan,
  getShoppingItems,
  saveShoppingItems,
  saveSnapshot,
  updateMeal,
  addMeal,
  deleteMeal,
} from "../db/plansRepo.js";
import { getSettings } from "../db/settingsRepo.js";
import { householdServings } from "../domain/portions.js";
import { partitionMeals, isAdjustable, type AdjustScope } from "../domain/adjust.js";
import {
  buildShoppingList,
  consolidateShoppingList,
  excludeOnHand,
  shoppingDelta,
} from "../domain/shopping.js";
import { scaleRawMeal } from "../llm/curationService.js";
import { log, logError } from "../log.js";

export interface AdjustmentDeps {
  db: Database.Database;
  curator: PlanCurator;
  store: JobStore;
}

export interface AdjustmentInput {
  planId: number;
  weekStart: string;
  note: string;
  scope: AdjustScope;
}

/**
 * Kick off a mid-week ADJUSTMENT as a background job. Freezes the meals already eaten
 * (before the cutoff), asks the LLM for a change set to steer the rest of the week from
 * the directional note, applies it surgically (untouched meals keep their id + rating),
 * recomputes the shopping list and diffs old-vs-new into a delta stored on the job.
 *
 * A snapshot of the pre-adjustment plan is saved first, so every adjustment is recorded.
 * The returned `done` promise is for tests only — routes MUST NOT await it.
 */
export function enqueueAdjustment(
  deps: AdjustmentDeps,
  input: AdjustmentInput,
): { jobId: string; done: Promise<void> } {
  const { db, curator, store } = deps;
  const job = store.createJob(input.weekStart);
  const startedAt = Date.now();

  const scopeLabel =
    input.scope.kind === "days"
      ? `days ${input.scope.days.join(",")}`
      : `from ${input.scope.day}/${input.scope.slot}`;
  log("adjust", `job ${job.id} queued — plan ${input.planId}, ${scopeLabel}`);

  const done = (async () => {
    try {
      const plan = getPlan(db, input.planId);
      if (!plan) throw new Error(`plan ${input.planId} not found`);

      const settings = getSettings(db);
      const oldMeals = plan.meals;
      const scope = input.scope;
      const { fixed, adjustable } = partitionMeals(oldMeals, scope);

      const result = await curator.adjustWeek({
        settings,
        note: input.note,
        scope,
        fixedMeals: fixed,
        adjustableMeals: adjustable,
        onHand: plan.onHand,
      });

      // Record the pre-adjustment state before we overwrite anything.
      saveSnapshot(db, input.planId, {
        note: input.note,
        scope,
        meals: oldMeals,
        shopping: getShoppingItems(db, input.planId),
      });

      const servings = householdServings(settings.household);
      const byCell = new Map<string, Meal>();
      for (const m of adjustable) byCell.set(`${m.day}:${m.slot}`, m);

      // Removals — only the adjustable region; never touch a fixed cell.
      for (const r of result.removals) {
        if (!isAdjustable(r.day, r.slot, scope)) {
          log("adjust", `ignoring removal of out-of-scope cell ${r.day}/${r.slot}`);
          continue;
        }
        const key = `${r.day}:${r.slot}`;
        const existing = byCell.get(key);
        if (existing?.id != null) {
          deleteMeal(db, existing.id);
          byCell.delete(key);
        }
      }

      // Changes — replace an existing adjustable cell in place, or add a new one.
      for (const c of result.changes) {
        if (!isAdjustable(c.day, c.slot, scope)) {
          log("adjust", `ignoring change to out-of-scope cell ${c.day}/${c.slot}`);
          continue;
        }
        const scaled = scaleRawMeal(c, servings);
        const existing = byCell.get(`${c.day}:${c.slot}`);
        if (existing?.id != null) {
          updateMeal(db, existing.id, scaled);
        } else {
          addMeal(db, input.planId, scaled);
        }
      }

      const updated = getPlan(db, input.planId)!;

      // Recompute shopping. Use ONE consolidation mapping over the union of old+new
      // item names so the two buy lists line up for a correct quantity diff.
      const rawOld = buildShoppingList(oldMeals);
      const rawNew = buildShoppingList(updated.meals);
      const names = [
        ...new Set([...rawOld, ...rawNew].map((i) => i.name)),
      ];
      let mapping: Array<{ name: string; canonical: string }> = [];
      if (names.length > 1) {
        try {
          mapping = await curator.consolidateShopping(names);
        } catch (err) {
          logError(
            "adjust",
            "consolidation failed — diffing un-consolidated lists",
            err,
          );
          mapping = [];
        }
      }

      const oldBuy = excludeOnHand(
        consolidateShoppingList(rawOld, mapping),
        plan.onHand,
      ).toBuy;
      const newBuy = excludeOnHand(
        consolidateShoppingList(rawNew, mapping),
        plan.onHand,
      ).toBuy;

      saveShoppingItems(db, input.planId, newBuy);
      const delta = shoppingDelta(oldBuy, newBuy);

      store.markDone(job.id, input.planId, delta);
      const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
      log(
        "adjust",
        `job ${job.id} done — plan ${input.planId}, ${result.changes.length} changed, ${result.removals.length} removed, +${delta.toBuy.length}/-${delta.leftover.length} shopping (${secs}s)`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      store.markError(job.id, message);
      log("adjust", `job ${job.id} failed: ${message}`);
      logError("adjust", `job ${job.id} failed`, err);
    }
  })();

  return { jobId: job.id, done };
}
