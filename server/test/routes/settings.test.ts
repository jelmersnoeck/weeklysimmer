import { describe, it, expect } from "vitest";
import request from "supertest";
import { openDb } from "../../src/db/index.js";
import { saveSettings, getSettings } from "../../src/db/settingsRepo.js";
import { createApp } from "../../src/app.js";
import { makeSettings } from "../helpers/settings.js";
import type { PlanCurator } from "../../src/llm/anthropicClient.js";

const fakeCurator: PlanCurator = {
  async curate() {
    throw new Error("not used");
  },
  async regenerateMeal() {
    throw new Error("not used");
  },
};

function app(db = openDb(":memory:")) {
  return { app: createApp(db, { curator: fakeCurator }), db };
}

describe("GET /api/settings", () => {
  it("returns 200 with a saved configured profile", async () => {
    const { app: a, db } = app();
    saveSettings(db, makeSettings());

    const res = await request(a).get("/api/settings");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(getSettings(db));
    expect(res.body.configured).toBe(true);
    db.close();
  });

  it("returns the unconfigured default profile when nothing is saved", async () => {
    const { app: a, db } = app();
    const res = await request(a).get("/api/settings");
    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    db.close();
  });
});

describe("GET /api/options", () => {
  it("returns all option lists and the appetite factor table", async () => {
    const { app: a, db } = app();
    const res = await request(a).get("/api/options");

    expect(res.status).toBe(200);
    expect(res.body.proteins).toContain("chicken");
    expect(res.body.cuisines).toContain("mediterranean");
    expect(res.body.dishTypes).toContain("stir_fry");
    expect(res.body.flavours).toContain("umami");
    expect(res.body.avoids).toContain("spicy");
    expect(res.body.diets).toContain("low_fodmap");
    expect(res.body.vegetables).toContain("courgette");
    expect(res.body.fruits).toContain("berries");
    expect(res.body.frequencies).toEqual(["never", "occasionally", "weekly", "often"]);
    expect(res.body.appetites).toContain("hearty");
    expect(res.body.memberTypes).toEqual(["adult", "child", "toddler", "baby"]);
    expect(res.body.appetiteFactor.adult.hearty).toBe(1.2);
    expect(res.body.appetiteFactor.child.standard).toBe(0.5);
    db.close();
  });
});

describe("PUT /api/settings", () => {
  it("saves a valid profile and returns settings + conflicts", async () => {
    const { app: a, db } = app();
    const res = await request(a).put("/api/settings").send(makeSettings());

    expect(res.status).toBe(200);
    expect(res.body.settings.configured).toBe(true);
    expect(Array.isArray(res.body.conflicts)).toBe(true);
    // persisted: GET now returns the configured profile
    const get = await request(a).get("/api/settings");
    expect(get.body.configured).toBe(true);
    db.close();
  });

  it("returns diet conflicts for clashing selections", async () => {
    const { app: a, db } = app();
    const body = makeSettings({
      diet: "vegan",
      proteins: [{ key: "chicken", frequency: "often" }],
      flavoursLiked: ["cheesy"],
    });
    const res = await request(a).put("/api/settings").send(body);

    expect(res.status).toBe(200);
    const keys = res.body.conflicts.map((c: { key: string }) => c.key);
    expect(keys).toContain("chicken");
    expect(keys).toContain("cheesy");
    db.close();
  });

  it("generates an id for a member that lacks one", async () => {
    const { app: a, db } = app();
    const body = makeSettings({
      household: [{ id: "", type: "adult", appetite: "standard" }] as never,
    });
    const res = await request(a).put("/api/settings").send(body);
    expect(res.status).toBe(200);
    expect(typeof res.body.settings.household[0].id).toBe("string");
    expect(res.body.settings.household[0].id.length).toBeGreaterThan(0);
    db.close();
  });

  it("returns 400 for an empty household", async () => {
    const { app: a, db } = app();
    const res = await request(a)
      .put("/api/settings")
      .send(makeSettings({ household: [] }));
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    db.close();
  });

  it("returns 400 for an invalid member type", async () => {
    const { app: a, db } = app();
    const res = await request(a)
      .put("/api/settings")
      .send(makeSettings({ household: [{ id: "x", type: "robot", appetite: "standard" }] as never }));
    expect(res.status).toBe(400);
    db.close();
  });

  it("returns 400 for an invalid protein frequency", async () => {
    const { app: a, db } = app();
    const res = await request(a)
      .put("/api/settings")
      .send(makeSettings({ proteins: [{ key: "chicken", frequency: "daily" }] as never }));
    expect(res.status).toBe(400);
    db.close();
  });

  it("returns 400 for an invalid diet", async () => {
    const { app: a, db } = app();
    const res = await request(a)
      .put("/api/settings")
      .send(makeSettings({ diet: "carnivore" as never }));
    expect(res.status).toBe(400);
    db.close();
  });

  it("returns 400 for a malformed mealSchedule", async () => {
    const { app: a, db } = app();
    const res = await request(a)
      .put("/api/settings")
      .send(makeSettings({ mealSchedule: { breakfast: [true] } as never }));
    expect(res.status).toBe(400);
    db.close();
  });

  it("returns 400 when a preference list is not string[]", async () => {
    const { app: a, db } = app();
    const res = await request(a)
      .put("/api/settings")
      .send(makeSettings({ avoid: [1, 2] as never }));
    expect(res.status).toBe(400);
    db.close();
  });
});
