import { afterEach, describe, expect, test, vi } from "vitest";
import type { Settings } from "../../src/types";
import {
  generatePlan,
  getJob,
  getOptions,
  getPlan,
  getSettings,
  listJobs,
  updateSettings,
} from "../../src/api/client";
import { SLOT_ORDER } from "../../src/lib/meal";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("generatePlan", () => {
  test("POSTs to /api/plans/generate and returns the jobId from a 202", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ jobId: "job-123" }, true, 202),
    );
    vi.stubGlobal("fetch", fetchMock);

    const input = {
      weekStart: "2026-07-13",
      onHand: ["leek", "kale"],
      note: "quick meals",
      avoid: ["Chili"],
      enabledSlots: [
        { day: 0, slot: "breakfast" as const },
        { day: 0, slot: "dinner" as const },
      ],
    };
    const result = await generatePlan(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/plans/generate");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual(input);
    expect(result.jobId).toBe("job-123");
  });
});

describe("jobs", () => {
  test("listJobs GETs /api/jobs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await listJobs();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/jobs");
  });

  test("getJob GETs /api/jobs/:id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ id: "job-123", status: "running" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const job = await getJob("job-123");

    expect(fetchMock.mock.calls[0][0]).toBe("/api/jobs/job-123");
    expect(job.id).toBe("job-123");
  });
});

const sampleSettings: Settings = {
  configured: true,
  household: [{ id: "a1", type: "adult", appetite: "standard" }],
  proteins: [{ key: "chicken", frequency: "often" }],
  vegetablesLiked: ["carrot"],
  fruitsLiked: [],
  cuisinesLiked: [],
  dishTypesLiked: [],
  flavoursLiked: [],
  avoid: [],
  diet: "none",
  effort: "easy",
  mealSchedule: Object.fromEntries(
    SLOT_ORDER.map((s) => [s, Array(7).fill(true)]),
  ) as Settings["mealSchedule"],
};

describe("settings", () => {
  test("getSettings GETs /api/settings", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(sampleSettings));
    vi.stubGlobal("fetch", fetchMock);

    const settings = await getSettings();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/settings");
    expect(settings.configured).toBe(true);
  });

  test("getOptions GETs /api/options", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ proteins: ["chicken"] }));
    vi.stubGlobal("fetch", fetchMock);

    await getOptions();

    expect(fetchMock.mock.calls[0][0]).toBe("/api/options");
  });

  test("updateSettings PUTs the body and returns settings + conflicts", async () => {
    const conflicts = [
      { field: "proteins", key: "chicken", message: "Chicken isn't vegan" },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ settings: sampleSettings, conflicts }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await updateSettings(sampleSettings);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/settings");
    expect(init.method).toBe("PUT");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init.body)).toEqual(sampleSettings);
    expect(result.settings.configured).toBe(true);
    expect(result.conflicts).toEqual(conflicts);
  });
});

describe("error handling", () => {
  test("throws the server error message on non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ error: "plan not found" }, false, 404),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPlan(99)).rejects.toThrow("plan not found");
  });
});
