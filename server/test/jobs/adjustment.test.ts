import { describe, it, expect } from "vitest";
import { openDb } from "../../src/db/index.js";
import { saveSettings } from "../../src/db/settingsRepo.js";
import { makeSettings } from "../helpers/settings.js";
import { createJobStore } from "../../src/jobs/registry.js";
import { enqueueAdjustment } from "../../src/jobs/adjustment.js";
import { savePlan, getPlan, listSnapshots } from "../../src/db/plansRepo.js";
import type { PlanCurator } from "../../src/llm/anthropicClient.js";
import type { AdjustResult } from "../../src/llm/planSchema.js";
import type { Meal, WeeklyPlan } from "../../src/domain/types.js";

function meal(overrides: Partial<Meal>): Meal {
  return {
    day: 0,
    slot: "dinner",
    title: "A meal",
    cuisine: "western",
    proteinClass: "lean",
    base: "none",
    difficulty: "easy",
    ingredients: [{ name: "thing", quantity: 100, unit: "g", category: "pantry" }],
    steps: ["do it"],
    leftoverOf: null,
    rating: null,
    ...overrides,
  };
}

/** A plan: Monday dinner (frozen, rated), Thursday + Friday dinners (adjustable). */
function samplePlan(): WeeklyPlan {
  return {
    weekStart: "2026-07-13",
    onHand: [],
    note: "",
    status: "active",
    meals: [
      meal({
        day: 0,
        slot: "dinner",
        title: "Monday Salmon",
        rating: 5,
        ingredients: [{ name: "salmon", quantity: 150, unit: "g", category: "fish" }],
      }),
      meal({
        day: 3,
        slot: "dinner",
        title: "Thursday Beef",
        ingredients: [{ name: "beef", quantity: 150, unit: "g", category: "meat" }],
      }),
      meal({
        day: 4,
        slot: "dinner",
        title: "Friday Pasta",
        ingredients: [{ name: "pasta", quantity: 100, unit: "g", category: "grains" }],
      }),
    ],
  };
}

/** Curator that swaps Thursday dinner for a tofu dish and removes Friday dinner. */
function adjustingCurator(): PlanCurator {
  const result: AdjustResult = {
    changes: [
      {
        day: 3,
        slot: "dinner",
        title: "Thursday Tofu Stir Fry",
        cuisine: "asian",
        proteinClass: "vegetarian",
        base: "rice",
        difficulty: "easy",
        prepMinutes: 10,
        cookMinutes: 15,
        caloriesPerServing: 450,
        ingredients: [{ name: "tofu", quantity: 120, unit: "g", category: "pantry" }],
        steps: ["Fry tofu"],
        sourceUrl: "https://example.com/tofu",
        leftoverOf: null,
      },
    ],
    removals: [{ day: 4, slot: "dinner" }],
  };
  return {
    async curate() {
      throw new Error("not used");
    },
    async regenerateMeal() {
      throw new Error("not used");
    },
    async adjustWeek() {
      return result;
    },
    async consolidateShopping(names) {
      return names.map((n) => ({ name: n, canonical: n }));
    },
  };
}

describe("enqueueAdjustment", () => {
  it("freezes eaten meals, applies the change set, and reports a delta", async () => {
    const db = openDb(":memory:");
    saveSettings(db, makeSettings());
    const planId = savePlan(db, samplePlan());

    const before = getPlan(db, planId)!;
    const mondayBefore = before.meals.find((m) => m.day === 0)!;

    // Cutoff at Thursday breakfast: Monday is frozen, Thu/Fri dinners are adjustable.
    const { done } = enqueueAdjustment(
      { db, curator: adjustingCurator(), store: createJobStore() },
      {
        planId,
        weekStart: before.weekStart,
        note: "less red meat, more veg",
        scope: { kind: "from", day: 3, slot: "breakfast" },
      },
    );
    await done;

    const after = getPlan(db, planId)!;

    // Frozen Monday meal untouched — same id AND rating preserved.
    const mondayAfter = after.meals.find((m) => m.day === 0)!;
    expect(mondayAfter.id).toBe(mondayBefore.id);
    expect(mondayAfter.title).toBe("Monday Salmon");
    expect(mondayAfter.rating).toBe(5);

    // Thursday dinner replaced.
    const thu = after.meals.find((m) => m.day === 3 && m.slot === "dinner")!;
    expect(thu.title).toBe("Thursday Tofu Stir Fry");

    // Friday dinner removed.
    expect(after.meals.find((m) => m.day === 4 && m.slot === "dinner")).toBeUndefined();

    db.close();
  });

  it("stores a snapshot and a shopping delta on the job", async () => {
    const db = openDb(":memory:");
    saveSettings(db, makeSettings());
    const planId = savePlan(db, samplePlan());
    const store = createJobStore();

    const { jobId, done } = enqueueAdjustment(
      { db, curator: adjustingCurator(), store },
      {
        planId,
        weekStart: "2026-07-13",
        note: "more veg",
        scope: { kind: "from", day: 3, slot: "breakfast" },
      },
    );
    await done;

    const job = store.getJob(jobId)!;
    expect(job.status).toBe("done");
    expect(job.planId).toBe(planId);
    // beef went away (leftover), tofu appeared (toBuy).
    expect(job.result).not.toBeNull();
    expect(job.result!.toBuy.some((i) => i.name.toLowerCase().includes("tofu"))).toBe(true);
    expect(
      job.result!.leftover.some((i) => i.name.toLowerCase().includes("beef")),
    ).toBe(true);

    // One snapshot recorded, holding the pre-adjustment meals + the scope.
    const snaps = listSnapshots(db, planId);
    expect(snaps).toHaveLength(1);
    expect(snaps[0].note).toBe("more veg");
    expect(snaps[0].scope).toEqual({ kind: "from", day: 3, slot: "breakfast" });
    expect(snaps[0].meals.some((m) => m.title === "Friday Pasta")).toBe(true);

    db.close();
  });

  it("with a days scope, changes only the selected day and keeps the rest", async () => {
    const db = openDb(":memory:");
    saveSettings(db, makeSettings());
    const planId = savePlan(db, samplePlan());

    // The curator would change Thursday (day 3) + remove Friday (day 4), but the
    // scope only allows Thursday — Friday must survive as out-of-scope.
    const { done } = enqueueAdjustment(
      { db, curator: adjustingCurator(), store: createJobStore() },
      {
        planId,
        weekStart: "2026-07-13",
        note: "make Thursday vegetarian",
        scope: { kind: "days", days: [3] },
      },
    );
    await done;

    const after = getPlan(db, planId)!;
    // Thursday changed…
    expect(
      after.meals.find((m) => m.day === 3 && m.slot === "dinner")!.title,
    ).toBe("Thursday Tofu Stir Fry");
    // …but Friday's removal was out of scope, so it stays.
    expect(after.meals.find((m) => m.day === 4 && m.slot === "dinner")).toBeTruthy();
    // Monday untouched.
    expect(after.meals.find((m) => m.day === 0)!.title).toBe("Monday Salmon");
    db.close();
  });
});
