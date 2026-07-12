import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { openDb } from "../../src/db/index.js";
import { seedSettings } from "../../src/db/seed.js";
import { generatePlan } from "../../src/llm/curationService.js";
import type { PlanCurator, CuratorInput } from "../../src/llm/anthropicClient.js";
import type { RawPlan } from "../../src/llm/planSchema.js";

const cannedPlan: RawPlan = {
  meals: [
    {
      day: 0,
      slot: "dinner",
      title: "Lemon chicken with rice and carrots",
      cuisine: "mediterranean",
      proteinClass: "lean",
      base: "rice",
      difficulty: "easy",
      ingredients: [
        { name: "chicken breast", quantity: 150, unit: "g", category: "meat" },
        { name: "rice", quantity: 60, unit: "g", category: "grains" },
        { name: "carrots", quantity: 100, unit: "g", category: "produce" },
      ],
      steps: ["Cook the rice.", "Pan-fry the chicken.", "Steam the carrots."],
      sourceUrl: "https://example.com/lemon-chicken",
      leftoverOf: null,
    },
    {
      day: 1,
      slot: "lunch",
      title: "Chicken rice bowl (leftovers)",
      cuisine: "mediterranean",
      proteinClass: "lean",
      base: "rice",
      difficulty: "easy",
      ingredients: [
        { name: "chicken breast", quantity: 100, unit: "g", category: "meat" },
        { name: "rice", quantity: 40, unit: "g", category: "grains" },
      ],
      steps: ["Reheat and assemble."],
      leftoverOf: { day: 0, slot: "dinner" },
    },
  ],
};

/** Fake curator: returns the canned plan, records what it was asked. */
function fakeCurator(plan: RawPlan): { curator: PlanCurator; calls: CuratorInput[] } {
  const calls: CuratorInput[] = [];
  const curator: PlanCurator = {
    async curate(input) {
      calls.push(input);
      return plan;
    },
    async regenerateMeal() {
      throw new Error("not used in generatePlan tests");
    },
  };
  return { curator, calls };
}

describe("generatePlan", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDb(":memory:");
    seedSettings(db);
  });

  afterEach(() => {
    db.close();
  });

  const input = {
    weekStart: "2026-07-13",
    vegBox: ["carrots", "spinach"],
    note: "lighter week",
    avoid: ["Tuna pasta bake"],
  };

  it("scales ingredient quantities by the household serving count (3)", async () => {
    const { curator } = fakeCurator(cannedPlan);
    const { plan } = await generatePlan(db, curator, input);

    // Seeded household is 1.15 + 1.15 + 0.5 = 2.8 -> 3 servings.
    const dinner = plan.meals.find((m) => m.slot === "dinner")!;
    const chicken = dinner.ingredients.find((i) => i.name === "chicken breast")!;
    expect(chicken.quantity).toBe(450); // 150 * 3
    const rice = dinner.ingredients.find((i) => i.name === "rice")!;
    expect(rice.quantity).toBe(180); // 60 * 3
  });

  it("passes settings and input through to the curator", async () => {
    const { curator, calls } = fakeCurator(cannedPlan);
    await generatePlan(db, curator, input);
    expect(calls).toHaveLength(1);
    expect(calls[0].weekStart).toBe(input.weekStart);
    expect(calls[0].vegBox).toEqual(input.vegBox);
    expect(calls[0].avoid).toEqual(input.avoid);
    expect(calls[0].settings.members).toHaveLength(3);
  });

  it("carries meal fields through and builds a WeeklyPlan", async () => {
    const { curator } = fakeCurator(cannedPlan);
    const { plan } = await generatePlan(db, curator, input);

    expect(plan.weekStart).toBe(input.weekStart);
    expect(plan.vegBox).toEqual(input.vegBox);
    expect(plan.note).toBe(input.note);
    expect(plan.status).toBe("active");
    expect(plan.meals).toHaveLength(2);

    const lunch = plan.meals.find((m) => m.slot === "lunch")!;
    expect(lunch.title).toBe("Chicken rice bowl (leftovers)");
    expect(lunch.leftoverOf).toEqual({ day: 0, slot: "dinner" });
    const dinner = plan.meals.find((m) => m.slot === "dinner")!;
    expect(dinner.sourceUrl).toBe("https://example.com/lemon-chicken");
    expect(dinner.cuisine).toBe("mediterranean");
    expect(dinner.base).toBe("rice");
    expect(dinner.difficulty).toBe("easy");
  });

  it("aggregates the shopping list from scaled quantities, excluding leftover meals", async () => {
    const { curator } = fakeCurator(cannedPlan);
    const { shopping } = await generatePlan(db, curator, input);

    // Only the day-0 dinner is shopped; the day-1 lunch is leftovers of it, so its
    // chicken/rice must NOT be added again. chicken: 150*3=450; rice: 60*3=180; carrots: 100*3=300.
    const chicken = shopping.find((s) => s.name.toLowerCase() === "chicken breast")!;
    expect(chicken.totalQuantity).toBe(450);
    const rice = shopping.find((s) => s.name.toLowerCase() === "rice")!;
    expect(rice.totalQuantity).toBe(180);
    const carrots = shopping.find((s) => s.name.toLowerCase() === "carrots")!;
    expect(carrots.totalQuantity).toBe(300);
  });

  it("reports veg that no meal used", async () => {
    const { curator } = fakeCurator(cannedPlan);
    const { unusedVeg } = await generatePlan(db, curator, input);
    // carrots are used; spinach is not.
    expect(unusedVeg).toContain("spinach");
    expect(unusedVeg).not.toContain("carrots");
  });

  it("does not persist the plan", async () => {
    const { curator } = fakeCurator(cannedPlan);
    await generatePlan(db, curator, input);
    const row = db.prepare("SELECT COUNT(*) AS n FROM weekly_plans").get() as { n: number };
    expect(row.n).toBe(0);
  });

  it("rejects a plan with two meals sharing the same day and slot", async () => {
    const dupPlan: RawPlan = {
      meals: [
        cannedPlan.meals[0],
        { ...cannedPlan.meals[1], day: 0, slot: "dinner" },
      ],
    };
    const { curator } = fakeCurator(dupPlan);
    await expect(generatePlan(db, curator, input)).rejects.toThrow(
      "LLM returned duplicate meals for the same day and slot",
    );
  });
});
