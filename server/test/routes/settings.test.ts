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

describe("GET /api/settings", () => {
  it("returns 200 with a saved configured profile", async () => {
    const db = openDb(":memory:");
    saveSettings(db, makeSettings());
    const app = createApp(db, { curator: fakeCurator });

    const res = await request(app).get("/api/settings");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(getSettings(db));
    expect(res.body.configured).toBe(true);
    db.close();
  });

  it("returns the unconfigured default profile when nothing is saved", async () => {
    const db = openDb(":memory:");
    const app = createApp(db, { curator: fakeCurator });

    const res = await request(app).get("/api/settings");

    expect(res.status).toBe(200);
    expect(res.body.configured).toBe(false);
    db.close();
  });
});
