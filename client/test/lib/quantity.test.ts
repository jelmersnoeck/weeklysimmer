import { describe, expect, test } from "vitest";
import { formatQuantity } from "../../src/lib/quantity";

const withCups = {
  quantity: 180,
  unit: "g",
  cupQuantity: 0.75,
  cupUnit: "cup",
};

const metricOnly = { quantity: 180, unit: "g" };

describe("formatQuantity", () => {
  test("metric + cups shows both, metric first", () => {
    expect(formatQuantity(withCups, ["metric", "cups"])).toBe("180 g · ¾ cup");
  });

  test("cups only shows the cup measure", () => {
    expect(formatQuantity(withCups, ["cups"])).toBe("¾ cup");
  });

  test("metric only shows the metric measure", () => {
    expect(formatQuantity(withCups, ["metric"])).toBe("180 g");
  });

  test("falls back to metric when cups requested but no cup measure exists", () => {
    expect(formatQuantity(metricOnly, ["cups"])).toBe("180 g");
  });

  test("both requested but no cup measure shows metric only", () => {
    expect(formatQuantity(metricOnly, ["metric", "cups"])).toBe("180 g");
  });
});
