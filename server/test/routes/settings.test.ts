import { describe, it, expect } from "vitest";
import request from "supertest";
import { openDb } from "../../src/db/index.js";
import { seedSettings, getSettings } from "../../src/db/seed.js";
import { createApp } from "../../src/app.js";
import type { PlanCurator } from "../../src/llm/anthropicClient.js";

const fakeCurator: PlanCurator = {
  async curate() {
    throw new Error("not used");
  },
  async regenerateMeal() {
    throw new Error("not used");
  },
};

describe("GET /api/settings", () => {
  it("returns 200 with the seeded settings", async () => {
    const db = openDb(":memory:");
    seedSettings(db);
    const app = createApp(db, { curator: fakeCurator });

    const res = await request(app).get("/api/settings");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(getSettings(db));
    db.close();
  });
});
