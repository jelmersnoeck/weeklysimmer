import { describe, it, expect } from "vitest";
import request from "supertest";
import type Database from "better-sqlite3";
import { openDb } from "../../src/db/index.js";
import { seedSettings } from "../../src/db/seed.js";
import { createApp } from "../../src/app.js";
import type {
  PlanCurator,
  RegenerateMealInput,
} from "../../src/llm/anthropicClient.js";
import type { RawPlan, RawMeal } from "../../src/llm/planSchema.js";

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
      ingredients: [
        { name: "chicken breast", quantity: 150, unit: "g", category: "meat" },
        { name: "rice", quantity: 60, unit: "g", category: "grains" },
        { name: "carrots", quantity: 100, unit: "g", category: "produce" },
      ],
      steps: ["Cook the rice.", "Pan-fry the chicken."],
      sourceUrl: "https://example.com/lemon-chicken",
      leftoverOf: null,
    },
    {
      day: 1,
      slot: "lunch",
      title: "Chicken Rice Bowl",
      cuisine: "mediterranean",
      proteinClass: "lean",
      base: "rice",
      difficulty: "easy",
      ingredients: [
        { name: "chicken breast", quantity: 100, unit: "g", category: "meat" },
      ],
      steps: ["Assemble."],
      leftoverOf: { day: 0, slot: "dinner" },
    },
  ],
};

const replacementMeal: RawMeal = {
  day: 0,
  slot: "dinner",
  title: "Turkey Meatballs with Rice",
  cuisine: "italian",
  proteinClass: "lean",
  base: "rice",
  difficulty: "easy",
  ingredients: [
    { name: "turkey mince", quantity: 160, unit: "g", category: "meat" },
    { name: "rice", quantity: 60, unit: "g", category: "grains" },
  ],
  steps: ["Roll meatballs.", "Bake."],
  sourceUrl: "https://example.com/turkey-meatballs",
  leftoverOf: null,
};

function fakeCurator(regenCalls: RegenerateMealInput[]): PlanCurator {
  return {
    async curate() {
      return cannedPlan;
    },
    async regenerateMeal(input) {
      regenCalls.push(input);
      return replacementMeal;
    },
  };
}

function makeApp(): {
  app: ReturnType<typeof createApp>;
  db: Database.Database;
  regenCalls: RegenerateMealInput[];
} {
  const db = openDb(":memory:");
  seedSettings(db);
  const regenCalls: RegenerateMealInput[] = [];
  const app = createApp(db, { curator: fakeCurator(regenCalls) });
  return { app, db, regenCalls };
}

const generateBody = {
  weekStart: "2026-07-13",
  vegBox: ["carrots", "spinach"],
  note: "lighter week",
  avoid: ["Tuna pasta bake"],
};

describe("POST /api/plans/generate", () => {
  it("creates a plan, scales ingredients x3, aggregates shopping and reports unused veg", async () => {
    const { app, db } = makeApp();
    const res = await request(app).post("/api/plans/generate").send(generateBody);

    expect(res.status).toBe(201);
    expect(typeof res.body.planId).toBe("number");

    // ingredients scaled by household servings (2.8 -> 3)
    const dinner = res.body.plan.meals.find(
      (m: { slot: string }) => m.slot === "dinner",
    );
    const chicken = dinner.ingredients.find(
      (i: { name: string }) => i.name === "chicken breast",
    );
    expect(chicken.quantity).toBe(450); // 150 * 3

    // shopping excludes the leftover lunch: only the dinner's chicken 150 * 3 = 450
    const shopChicken = res.body.shopping.find(
      (s: { name: string }) => s.name.toLowerCase() === "chicken breast",
    );
    expect(shopChicken.totalQuantity).toBe(450);

    // unused veg present: spinach used by no meal, carrots is used
    expect(res.body.unusedVeg).toContain("spinach");
    expect(res.body.unusedVeg).not.toContain("carrots");

    // follow-up GET finds it
    const get = await request(app).get(`/api/plans/${res.body.planId}`);
    expect(get.status).toBe(200);
    expect(get.body.plan.id).toBe(res.body.planId);
    db.close();
  });

  it("returns 400 when weekStart is missing", async () => {
    const { app, db } = makeApp();
    const res = await request(app)
      .post("/api/plans/generate")
      .send({ vegBox: [], note: "", avoid: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    db.close();
  });

  it("returns 400 when vegBox is not an array", async () => {
    const { app, db } = makeApp();
    const res = await request(app)
      .post("/api/plans/generate")
      .send({ weekStart: "2026-07-13", vegBox: "carrots" });
    expect(res.status).toBe(400);
    db.close();
  });
});

describe("GET /api/plans", () => {
  it("lists plan summaries newest first", async () => {
    const { app, db } = makeApp();
    const a = await request(app)
      .post("/api/plans/generate")
      .send({ ...generateBody, weekStart: "2026-07-06" });
    const b = await request(app)
      .post("/api/plans/generate")
      .send({ ...generateBody, weekStart: "2026-07-13" });

    const res = await request(app).get("/api/plans");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(b.body.planId);
    expect(res.body[1].id).toBe(a.body.planId);
    db.close();
  });
});

describe("GET /api/plans/:id", () => {
  it("returns 404 for a missing plan", async () => {
    const { app, db } = makeApp();
    const res = await request(app).get("/api/plans/999");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
    db.close();
  });

  it("returns plan, shopping and recomputed unusedVeg", async () => {
    const { app, db } = makeApp();
    const created = await request(app)
      .post("/api/plans/generate")
      .send(generateBody);
    const res = await request(app).get(`/api/plans/${created.body.planId}`);

    expect(res.status).toBe(200);
    expect(res.body.plan.weekStart).toBe("2026-07-13");
    expect(res.body.shopping.length).toBeGreaterThan(0);
    expect(res.body.unusedVeg).toContain("spinach");
    db.close();
  });
});

describe("POST /api/meals/:mealId/rate", () => {
  it("rates a meal and the rating shows on a later GET", async () => {
    const { app, db } = makeApp();
    const created = await request(app)
      .post("/api/plans/generate")
      .send(generateBody);
    const planId = created.body.planId;
    const mealId = created.body.plan.meals.find(
      (m: { slot: string }) => m.slot === "dinner",
    ).id;

    const rate = await request(app)
      .post(`/api/meals/${mealId}/rate`)
      .send({ rating: 4 });
    expect(rate.status).toBe(200);
    expect(rate.body.ok).toBe(true);

    const get = await request(app).get(`/api/plans/${planId}`);
    const rated = get.body.plan.meals.find(
      (m: { id: number }) => m.id === mealId,
    );
    expect(rated.rating).toBe(4);
    db.close();
  });

  it("returns 400 for an out-of-range rating", async () => {
    const { app, db } = makeApp();
    const res = await request(app).post("/api/meals/1/rate").send({ rating: 9 });
    expect(res.status).toBe(400);
    db.close();
  });

  it("returns 400 for a non-numeric rating", async () => {
    const { app, db } = makeApp();
    const res = await request(app)
      .post("/api/meals/1/rate")
      .send({ rating: "good" });
    expect(res.status).toBe(400);
    db.close();
  });
});

describe("POST /api/plans/:id/meals/:mealId/regenerate", () => {
  it("swaps one meal, re-aggregates shopping and resets the rating", async () => {
    const { app, db } = makeApp();
    const created = await request(app)
      .post("/api/plans/generate")
      .send(generateBody);
    const planId = created.body.planId;
    const dinner = created.body.plan.meals.find(
      (m: { slot: string }) => m.slot === "dinner",
    );

    // rate it first, to prove regenerate resets the rating
    await request(app).post(`/api/meals/${dinner.id}/rate`).send({ rating: 5 });

    const res = await request(app).post(
      `/api/plans/${planId}/meals/${dinner.id}/regenerate`,
    );
    expect(res.status).toBe(200);

    const newDinner = res.body.plan.meals.find(
      (m: { id: number }) => m.id === dinner.id,
    );
    // title changed to the replacement, same slot/day preserved
    expect(newDinner.title).toBe("Turkey Meatballs with Rice");
    expect(newDinner.slot).toBe("dinner");
    expect(newDinner.day).toBe(0);
    // rating reset
    expect(newDinner.rating).toBeNull();
    // replacement ingredients scaled x3
    const turkey = newDinner.ingredients.find(
      (i: { name: string }) => i.name === "turkey mince",
    );
    expect(turkey.quantity).toBe(480); // 160 * 3

    // shopping re-aggregated: turkey now present, old chicken from that dinner gone
    const shopTurkey = res.body.shopping.find(
      (s: { name: string }) => s.name.toLowerCase() === "turkey mince",
    );
    expect(shopTurkey.totalQuantity).toBe(480);
    // the only other meal is a leftover lunch (excluded from shopping), so the old
    // chicken is gone entirely from the buy list.
    const shopChicken = res.body.shopping.find(
      (s: { name: string }) => s.name.toLowerCase() === "chicken breast",
    );
    expect(shopChicken).toBeUndefined();
    db.close();
  });

  it("passes the target meal's protein class through to the curator", async () => {
    const { app, db, regenCalls } = makeApp();
    const created = await request(app)
      .post("/api/plans/generate")
      .send(generateBody);
    const dinner = created.body.plan.meals.find(
      (m: { slot: string }) => m.slot === "dinner",
    );

    await request(app).post(
      `/api/plans/${created.body.planId}/meals/${dinner.id}/regenerate`,
    );

    expect(regenCalls).toHaveLength(1);
    // the day-0 dinner is a "lean" meal in cannedPlan
    expect(regenCalls[0].proteinClass).toBe("lean");
    db.close();
  });

  it("returns 404 when the plan is missing", async () => {
    const { app, db } = makeApp();
    const res = await request(app).post("/api/plans/999/meals/1/regenerate");
    expect(res.status).toBe(404);
    db.close();
  });

  it("returns 404 when the meal is not in the plan", async () => {
    const { app, db } = makeApp();
    const created = await request(app)
      .post("/api/plans/generate")
      .send(generateBody);
    const res = await request(app).post(
      `/api/plans/${created.body.planId}/meals/99999/regenerate`,
    );
    expect(res.status).toBe(404);
    db.close();
  });
});
