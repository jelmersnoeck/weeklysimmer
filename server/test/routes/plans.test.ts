import { describe, it, expect } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type Database from "better-sqlite3";
import { openDb } from "../../src/db/index.js";
import { saveSettings } from "../../src/db/settingsRepo.js";
import { makeSettings } from "../helpers/settings.js";
import { createApp } from "../../src/app.js";
import { createJobStore, type JobStore } from "../../src/jobs/registry.js";
import type {
  PlanCurator,
  CuratorInput,
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
      prepMinutes: 10,
      cookMinutes: 20,
      caloriesPerServing: 540,
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
      prepMinutes: 5,
      cookMinutes: 0,
      caloriesPerServing: 300,
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
  prepMinutes: 15,
  cookMinutes: 15,
  caloriesPerServing: 610,
  ingredients: [
    { name: "turkey mince", quantity: 160, unit: "g", category: "meat" },
    { name: "rice", quantity: 60, unit: "g", category: "grains" },
  ],
  steps: ["Roll meatballs.", "Bake."],
  sourceUrl: "https://example.com/turkey-meatballs",
  leftoverOf: null,
};

function fakeCurator(
  regenCalls: RegenerateMealInput[],
  curateCalls: CuratorInput[],
): PlanCurator {
  return {
    async curate(input) {
      curateCalls.push(input);
      return cannedPlan;
    },
    async regenerateMeal(input) {
      regenCalls.push(input);
      return replacementMeal;
    },
  };
}

function makeApp(): {
  app: Express;
  db: Database.Database;
  store: JobStore;
  regenCalls: RegenerateMealInput[];
  curateCalls: CuratorInput[];
} {
  const db = openDb(":memory:");
  saveSettings(db, makeSettings());
  const regenCalls: RegenerateMealInput[] = [];
  const curateCalls: CuratorInput[] = [];
  const store = createJobStore();
  const app = createApp(db, {
    curator: fakeCurator(regenCalls, curateCalls),
    store,
  });
  return { app, db, store, regenCalls, curateCalls };
}

/** Poll a job to a terminal state. Each request round-trip yields the event
 * loop, letting the (fake, immediately-resolving) background work settle — no
 * real timers or network. */
async function waitForJob(app: Express, jobId: string) {
  for (let i = 0; i < 50; i++) {
    const res = await request(app).get(`/api/jobs/${jobId}`);
    if (res.body.status === "done" || res.body.status === "error") {
      return res.body as {
        id: string;
        status: string;
        planId: number | null;
        error: string | null;
      };
    }
  }
  throw new Error("job did not reach a terminal state");
}

/** Drive the full async generate flow and return the persisted plan. */
async function createPlan(app: Express, body: Record<string, unknown>) {
  const res = await request(app).post("/api/plans/generate").send(body);
  expect(res.status).toBe(202);
  const jobId = res.body.jobId as string;
  const job = await waitForJob(app, jobId);
  expect(job.status).toBe("done");
  const planId = job.planId!;
  const get = await request(app).get(`/api/plans/${planId}`);
  return { planId, plan: get.body.plan, shopping: get.body.shopping, jobId };
}

const generateBody = {
  weekStart: "2026-07-13",
  onHand: ["carrots", "spinach"],
  note: "lighter week",
  avoid: ["Tuna pasta bake"],
};

describe("POST /api/plans/generate", () => {
  it("returns 202 + jobId and does not persist synchronously", async () => {
    const { app, db } = makeApp();
    const res = await request(app).post("/api/plans/generate").send(generateBody);

    expect(res.status).toBe(202);
    expect(typeof res.body.jobId).toBe("string");
    // no full plan shape in the immediate response
    expect(res.body.plan).toBeUndefined();
    expect(res.body.planId).toBeUndefined();
    db.close();
  });

  it("completes in the background: plan persists, scaled x3, shopping aggregated", async () => {
    const { app, db } = makeApp();
    const { plan, shopping, planId } = await createPlan(app, generateBody);

    expect(typeof planId).toBe("number");
    // ingredients scaled by household servings (2.8 -> 3)
    const dinner = plan.meals.find((m: { slot: string }) => m.slot === "dinner");
    const chicken = dinner.ingredients.find(
      (i: { name: string }) => i.name === "chicken breast",
    );
    expect(chicken.quantity).toBe(450); // 150 * 3

    // shopping excludes the leftover lunch: only the dinner's chicken 150 * 3 = 450
    const shopChicken = shopping.find(
      (s: { name: string }) => s.name.toLowerCase() === "chicken breast",
    );
    expect(shopChicken.totalQuantity).toBe(450);
    db.close();
  });

  it("shows the job via GET /api/jobs/:id", async () => {
    const { app, db } = makeApp();
    const res = await request(app).post("/api/plans/generate").send(generateBody);
    const jobId = res.body.jobId;

    const job = await waitForJob(app, jobId);
    expect(job.id).toBe(jobId);
    expect(job.status).toBe("done");
    expect(typeof job.planId).toBe("number");
    db.close();
  });

  it("returns 400 when weekStart is missing, creating no job", async () => {
    const { app, db, store } = makeApp();
    const res = await request(app)
      .post("/api/plans/generate")
      .send({ onHand: [], note: "", avoid: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(store.listJobs()).toHaveLength(0);
    db.close();
  });

  it("returns 400 when onHand is not an array", async () => {
    const { app, db } = makeApp();
    const res = await request(app)
      .post("/api/plans/generate")
      .send({ weekStart: "2026-07-13", onHand: "carrots" });
    expect(res.status).toBe(400);
    db.close();
  });

  it("returns 400 when an onHand entry is not a string", async () => {
    const { app, db } = makeApp();
    const res = await request(app)
      .post("/api/plans/generate")
      .send({ weekStart: "2026-07-13", onHand: ["carrots", 42] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    db.close();
  });

  it("derives enabledSlots from the settings default (all 35) when omitted", async () => {
    const { app, db, curateCalls } = makeApp();
    await createPlan(app, generateBody);
    expect(curateCalls).toHaveLength(1);
    // seeded mealSchedule is all-true => 5 slots x 7 days = 35 cells
    expect(curateCalls[0].enabledSlots).toHaveLength(35);
    expect(curateCalls[0].enabledSlots).toContainEqual({ day: 0, slot: "breakfast" });
    expect(curateCalls[0].enabledSlots).toContainEqual({ day: 6, slot: "dinner" });
    db.close();
  });

  it("passes a provided enabledSlots subset through to the curator", async () => {
    const { app, db, curateCalls } = makeApp();
    const enabledSlots = [
      { day: 0, slot: "dinner" },
      { day: 2, slot: "lunch" },
    ];
    await createPlan(app, { ...generateBody, enabledSlots });
    expect(curateCalls[0].enabledSlots).toEqual(enabledSlots);
    db.close();
  });

  it("returns 400 when an enabledSlots entry has an out-of-range day", async () => {
    const { app, db } = makeApp();
    const res = await request(app)
      .post("/api/plans/generate")
      .send({ ...generateBody, enabledSlots: [{ day: 7, slot: "dinner" }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    db.close();
  });

  it("returns 400 when an enabledSlots entry has an invalid slot", async () => {
    const { app, db } = makeApp();
    const res = await request(app)
      .post("/api/plans/generate")
      .send({ ...generateBody, enabledSlots: [{ day: 0, slot: "brunch" }] });
    expect(res.status).toBe(400);
    db.close();
  });
});

describe("GET /api/jobs", () => {
  it("lists jobs newest first", async () => {
    const { app, db } = makeApp();
    const a = await request(app)
      .post("/api/plans/generate")
      .send({ ...generateBody, weekStart: "2026-07-06" });
    const b = await request(app)
      .post("/api/plans/generate")
      .send({ ...generateBody, weekStart: "2026-07-13" });
    await waitForJob(app, a.body.jobId);
    await waitForJob(app, b.body.jobId);

    const res = await request(app).get("/api/jobs");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(b.body.jobId);
    expect(res.body[1].id).toBe(a.body.jobId);
    db.close();
  });
});

describe("GET /api/jobs/:id", () => {
  it("returns 404 for an unknown job", async () => {
    const { app, db } = makeApp();
    const res = await request(app).get("/api/jobs/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
    db.close();
  });
});

describe("GET /api/plans", () => {
  it("lists plan summaries newest first", async () => {
    const { app, db } = makeApp();
    const a = await createPlan(app, { ...generateBody, weekStart: "2026-07-06" });
    const b = await createPlan(app, { ...generateBody, weekStart: "2026-07-13" });

    const res = await request(app).get("/api/plans");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(b.planId);
    expect(res.body[1].id).toBe(a.planId);
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

  it("returns plan and shopping only", async () => {
    const { app, db } = makeApp();
    const created = await createPlan(app, generateBody);
    const res = await request(app).get(`/api/plans/${created.planId}`);

    expect(res.status).toBe(200);
    expect(res.body.plan.weekStart).toBe("2026-07-13");
    expect(res.body.shopping.length).toBeGreaterThan(0);
    expect(res.body).not.toHaveProperty("unusedVeg");
    db.close();
  });
});

describe("POST /api/meals/:mealId/rate", () => {
  it("rates a meal and the rating shows on a later GET", async () => {
    const { app, db } = makeApp();
    const created = await createPlan(app, generateBody);
    const planId = created.planId;
    const mealId = created.plan.meals.find(
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

  it("returns 404 when the meal does not exist", async () => {
    const { app, db } = makeApp();
    const res = await request(app)
      .post("/api/meals/99999/rate")
      .send({ rating: 4 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
    db.close();
  });

  it("returns 400 for a non-numeric mealId", async () => {
    const { app, db } = makeApp();
    const res = await request(app)
      .post("/api/meals/abc/rate")
      .send({ rating: 4 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    db.close();
  });
});

describe("POST /api/plans/:id/meals/:mealId/regenerate", () => {
  it("swaps one meal, re-aggregates shopping and resets the rating", async () => {
    const { app, db } = makeApp();
    const created = await createPlan(app, generateBody);
    const planId = created.planId;
    const dinner = created.plan.meals.find(
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
    // prep/cook time carried onto the replacement
    expect(newDinner.prepMinutes).toBe(15);
    expect(newDinner.cookMinutes).toBe(15);
    // per-serving calories carried onto the replacement, unscaled
    expect(newDinner.caloriesPerServing).toBe(610);
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
    const created = await createPlan(app, generateBody);
    const dinner = created.plan.meals.find(
      (m: { slot: string }) => m.slot === "dinner",
    );

    await request(app).post(
      `/api/plans/${created.planId}/meals/${dinner.id}/regenerate`,
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
    const created = await createPlan(app, generateBody);
    const res = await request(app).post(
      `/api/plans/${created.planId}/meals/99999/regenerate`,
    );
    expect(res.status).toBe(404);
    db.close();
  });
});
