import { afterEach, describe, expect, test, vi } from "vitest";
import { generatePlan, getPlan } from "../../src/api/client";

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
  test("POSTs to /api/plans/generate with the right body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ planId: 7, plan: {}, shopping: [] }, true, 201),
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
    expect(result.planId).toBe(7);
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
