import type Database from "better-sqlite3";
import type { PlanCurator } from "../llm/anthropicClient.js";
import type { JobStore } from "./registry.js";
import { generatePlan, type GeneratePlanInput } from "../llm/curationService.js";
import { savePlan, saveShoppingItems } from "../db/plansRepo.js";
import { log, logError } from "../log.js";

export interface GenerationDeps {
  db: Database.Database;
  curator: PlanCurator;
  store: JobStore;
}

/**
 * Kick off a weekly-plan generation as a background job. Registers a "running"
 * job and returns its id immediately; the LLM curation, portion scaling and
 * persistence run asynchronously so the caller can respond before they finish.
 *
 * The returned `done` promise resolves once the work settles (success or error).
 * It exists ONLY so tests can await completion deterministically — routes MUST
 * NOT await it (that would defeat the fire-and-forget design).
 */
export function enqueueGeneration(
  deps: GenerationDeps,
  input: GeneratePlanInput,
): { jobId: string; done: Promise<void> } {
  const { db, curator, store } = deps;
  const job = store.createJob(input.weekStart);
  const startedAt = Date.now();

  log(
    "generate",
    `job ${job.id} queued — week ${input.weekStart}, ${input.onHand.length} foods on hand, ${input.enabledSlots.length} meals requested`,
  );

  const done = (async () => {
    try {
      const { plan, shopping } = await generatePlan(db, curator, input);
      const planId = savePlan(db, plan);
      saveShoppingItems(db, planId, shopping);
      store.markDone(job.id, planId);
      const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
      log(
        "generate",
        `job ${job.id} done — plan ${planId}, ${plan.meals.length} meals, ${shopping.length} shopping items (${secs}s)`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      store.markError(job.id, message);
      log("generate", `job ${job.id} failed: ${message}`);
      logError("generate", `job ${job.id} failed`, err);
    }
  })();

  return { jobId: job.id, done };
}
