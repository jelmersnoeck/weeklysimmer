import { describe, it, expect } from "vitest";
import {
  cellOrdinal,
  isAdjustable,
  partitionMeals,
  slotOrdinal,
  type AdjustScope,
} from "../../src/domain/adjust.js";
import type { Meal } from "../../src/domain/types.js";

function meal(day: number, slot: Meal["slot"], title: string): Meal {
  return {
    day,
    slot,
    title,
    cuisine: "x",
    proteinClass: "lean",
    base: "none",
    difficulty: "easy",
    ingredients: [{ name: "a", quantity: 1, unit: "g", category: "pantry" }],
    steps: [],
    leftoverOf: null,
  };
}

describe("cell ordinals", () => {
  it("orders slots within a day", () => {
    expect(slotOrdinal("breakfast")).toBe(0);
    expect(slotOrdinal("dinner")).toBe(4);
    expect(cellOrdinal(1, "breakfast")).toBeGreaterThan(cellOrdinal(0, "dinner"));
  });
});

describe("isAdjustable — from (cut-off) scope", () => {
  const scope: AdjustScope = { kind: "from", day: 2, slot: "lunch" };

  it("marks the cut-off cell and later as adjustable, earlier as fixed", () => {
    expect(isAdjustable(0, "dinner", scope)).toBe(false); // before cut-off
    expect(isAdjustable(2, "breakfast", scope)).toBe(false); // same day, earlier slot
    expect(isAdjustable(2, "lunch", scope)).toBe(true); // the cut-off cell itself
    expect(isAdjustable(3, "breakfast", scope)).toBe(true); // later day
  });
});

describe("isAdjustable — days scope", () => {
  const scope: AdjustScope = { kind: "days", days: [1, 3] };

  it("marks only the listed days adjustable regardless of slot or order", () => {
    expect(isAdjustable(1, "breakfast", scope)).toBe(true);
    expect(isAdjustable(1, "dinner", scope)).toBe(true);
    expect(isAdjustable(3, "lunch", scope)).toBe(true);
    // Days not selected — including earlier AND later days — stay fixed.
    expect(isAdjustable(0, "dinner", scope)).toBe(false);
    expect(isAdjustable(2, "dinner", scope)).toBe(false);
    expect(isAdjustable(4, "dinner", scope)).toBe(false);
  });
});

describe("partitionMeals", () => {
  const meals = [
    meal(0, "dinner", "Mon dinner"),
    meal(1, "dinner", "Tue dinner"),
    meal(2, "lunch", "Wed lunch"),
    meal(3, "dinner", "Thu dinner"),
  ];

  it("splits around a cut-off", () => {
    const { fixed, adjustable } = partitionMeals(meals, {
      kind: "from",
      day: 2,
      slot: "lunch",
    });
    expect(fixed.map((m) => m.title)).toEqual(["Mon dinner", "Tue dinner"]);
    expect(adjustable.map((m) => m.title)).toEqual(["Wed lunch", "Thu dinner"]);
  });

  it("splits by selected days", () => {
    const { fixed, adjustable } = partitionMeals(meals, {
      kind: "days",
      days: [1, 3],
    });
    expect(adjustable.map((m) => m.title)).toEqual(["Tue dinner", "Thu dinner"]);
    expect(fixed.map((m) => m.title)).toEqual(["Mon dinner", "Wed lunch"]);
  });
});
