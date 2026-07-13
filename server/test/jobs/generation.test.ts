import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Database from "better-sqlite3";
import { openDb } from "../../src/db/index.js";
import { saveSettings } from "../../src/db/settingsRepo.js";
import { makeSettings } from "../helpers/settings.js";
import { createJobStore } from "../../src/jobs/registry.js";
import { enqueueGeneration } from "../../src/jobs/generation.js";
import { getPlan } from "../../src/db/plansRepo.js";
import type { PlanCurator } from "../../src/llm/anthropicClient.js";
import type { RawPlan } from "../../src/llm/planSchema.js";

const cannedPlan: RawPlan = {
  meals: [
    {
      day: 0,
      slot: "dinner",
      title: "Lemon Chicken with Rice",
      cuisine: "mediterranean",
      proteinClass: "lean",
      base: "rice",
      difficulty: "easy",
      prepMinutes: 10,
      cookMinutes: 20,
      caloriesPerServing: 540,
      ingredients: [
        { name: "chicken breast", quantity: 150, unit: "g", category: "meat" },
        { name: "rice", quantity: 60, unit: "g", category: "grains" },
      ],
      steps: ["Cook the rice.", "Pan-fry the chicken."],
      sourceUrl: "https://example.com/lemon-chicken",
      leftoverOf: null,
    },
  ],
};

function okCurator(): PlanCurator {
  return {
    async curate() {
      return cannedPlan;
    },
    async regenerateMeal() {
      throw new Error("not used");
    },
    async consolidateShopping(names) {
      return names.map((n) => ({ name: n, canonical: n }));
    },
  };
}

function failingCurator(message: string): PlanCurator {
  return {
    async curate() {
      throw new Error(message);
    },
    async regenerateMeal() {
      throw new Error("not used");
    },
    async consolidateShopping(names) {
      return names.map((n) => ({ name: n, canonical: n }));
    },
  };
}

const input = {
  weekStart: "2026-07-13",
  onHand: ["carrots"],
  note: "",
  avoid: [],
  enabledSlots: [{ day: 0, slot: "dinner" as const }],
};

describe("enqueueGeneration", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(":memory:");
    saveSettings(db, makeSettings());
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  it("returns a jobId immediately and persists the plan on success", async () => {
    const store = createJobStore();
    const { jobId, done } = enqueueGeneration(
      { db, curator: okCurator(), store },
      input,
    );

    // job exists and is running before the work completes
    expect(typeof jobId).toBe("string");
    const running = store.getJob(jobId)!;
    expect(running.status).toBe("running");

    await done;

    const job = store.getJob(jobId)!;
    expect(job.status).toBe("done");
    expect(typeof job.planId).toBe("number");
    // plan actually persisted
    const plan = getPlan(db, job.planId!);
    expect(plan).not.toBeNull();
    expect(plan!.weekStart).toBe("2026-07-13");
    expect(plan!.meals).toHaveLength(1);
  });

  it("marks the job errored and persists nothing when the curator rejects", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const store = createJobStore();
    const { jobId, done } = enqueueGeneration(
      { db, curator: failingCurator("model exploded"), store },
      input,
    );

    await done;

    const job = store.getJob(jobId)!;
    expect(job.status).toBe("error");
    expect(job.error).toBe("model exploded");
    expect(job.planId).toBeNull();
    const row = db
      .prepare("SELECT COUNT(*) AS n FROM weekly_plans")
      .get() as { n: number };
    expect(row.n).toBe(0);
  });
});
