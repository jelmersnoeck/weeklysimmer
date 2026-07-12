import { describe, it, expect } from "vitest";
import { validateSettings } from "../../src/domain/settingsValidation.js";
import { makeSettings } from "../helpers/settings.js";

describe("validateSettings", () => {
  it("accepts a valid profile and forces configured:true", () => {
    const result = validateSettings(makeSettings({ configured: false }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.settings.configured).toBe(true);
      expect(result.settings.household).toHaveLength(3);
    }
  });

  it("normalizes a missing member id by generating one", () => {
    const result = validateSettings(
      makeSettings({ household: [{ type: "adult", appetite: "hearty" }] as never }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(typeof result.settings.household[0].id).toBe("string");
      expect(result.settings.household[0].id.length).toBeGreaterThan(0);
    }
  });

  it("rejects a non-object body", () => {
    const result = validateSettings(null);
    expect(result.ok).toBe(false);
  });

  it("rejects an empty household", () => {
    const result = validateSettings(makeSettings({ household: [] }));
    expect(result.ok).toBe(false);
  });

  it("accepts a multi-value units array", () => {
    const result = validateSettings(makeSettings({ units: ["metric", "cups"] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.settings.units).toEqual(["metric", "cups"]);
  });

  it("rejects an empty units array", () => {
    const result = validateSettings(makeSettings({ units: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid measurement system", () => {
    const result = validateSettings(makeSettings({ units: ["imperial"] as never }));
    expect(result.ok).toBe(false);
  });
});
