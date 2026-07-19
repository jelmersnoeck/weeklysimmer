import { describe, it, expect } from "vitest";
import { createJobStore } from "../../src/jobs/registry.js";

describe("job registry", () => {
  it("creates a running job with an id, weekStart and createdAt", () => {
    const store = createJobStore();
    const job = store.createJob("2026-07-13");
    expect(job.status).toBe("running");
    expect(job.planId).toBeNull();
    expect(job.error).toBeNull();
    expect(job.weekStart).toBe("2026-07-13");
    expect(typeof job.id).toBe("string");
    expect(job.id.length).toBeGreaterThan(0);
    expect(typeof job.createdAt).toBe("string");
    // getJob returns the same job
    expect(store.getJob(job.id)).toEqual(job);
  });

  it("markDone sets status and planId, leaving result null by default", () => {
    const store = createJobStore();
    const job = store.createJob("2026-07-13");
    store.markDone(job.id, 42);
    const after = store.getJob(job.id)!;
    expect(after.status).toBe("done");
    expect(after.planId).toBe(42);
    expect(after.error).toBeNull();
    expect(after.result).toBeNull();
  });

  it("markDone stores an optional shopping delta result", () => {
    const store = createJobStore();
    const job = store.createJob("2026-07-13");
    const delta = {
      toBuy: [
        { name: "tofu", totalQuantity: 300, unit: "g", category: "pantry", checked: false },
      ],
      leftover: [],
    };
    store.markDone(job.id, 7, delta);
    expect(store.getJob(job.id)!.result).toEqual(delta);
  });

  it("markError sets status and error", () => {
    const store = createJobStore();
    const job = store.createJob("2026-07-13");
    store.markError(job.id, "boom");
    const after = store.getJob(job.id)!;
    expect(after.status).toBe("error");
    expect(after.error).toBe("boom");
    expect(after.planId).toBeNull();
  });

  it("getJob returns undefined for an unknown id", () => {
    const store = createJobStore();
    expect(store.getJob("nope")).toBeUndefined();
  });

  it("listJobs returns jobs newest first", () => {
    const store = createJobStore();
    const a = store.createJob("2026-07-06");
    const b = store.createJob("2026-07-13");
    const c = store.createJob("2026-07-20");
    const list = store.listJobs();
    expect(list.map((j) => j.id)).toEqual([c.id, b.id, a.id]);
  });

  it("markDone/markError on an unknown id are no-ops", () => {
    const store = createJobStore();
    expect(() => store.markDone("nope", 1)).not.toThrow();
    expect(() => store.markError("nope", "x")).not.toThrow();
  });

  it("isolated stores do not share state", () => {
    const a = createJobStore();
    const b = createJobStore();
    a.createJob("2026-07-13");
    expect(a.listJobs()).toHaveLength(1);
    expect(b.listJobs()).toHaveLength(0);
  });
});
