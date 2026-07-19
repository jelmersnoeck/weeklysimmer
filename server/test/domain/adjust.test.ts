import { describe, it, expect } from "vitest";
import {
  cellOrdinal,
  isFrozen,
  partitionMeals,
  slotOrdinal,
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

describe("cutoff helpers", () => {
  it("orders slots within a day", () => {
    expect(slotOrdinal("breakfast")).toBe(0);
    expect(slotOrdinal("dinner")).toBe(4);
    expect(cellOrdinal(1, "breakfast")).toBeGreaterThan(cellOrdinal(0, "dinner"));
  });

  it("freezes cells strictly before the cutoff", () => {
    const cutoff = { day: 2, slot: "lunch" as const };
    // Monday dinner is before Wednesday lunch → frozen.
    expect(isFrozen(0, "dinner", cutoff)).toBe(true);
    // The cutoff cell itself is NOT frozen (it's adjustable).
    expect(isFrozen(2, "lunch", cutoff)).toBe(false);
    // Wednesday breakfast is before Wednesday lunch → frozen.
    expect(isFrozen(2, "breakfast", cutoff)).toBe(true);
    // Thursday breakfast is after → adjustable.
    expect(isFrozen(3, "breakfast", cutoff)).toBe(false);
  });
});

describe("partitionMeals", () => {
  it("splits meals into frozen and adjustable around the cutoff", () => {
    const meals = [
      meal(0, "dinner", "Mon dinner"),
      meal(2, "breakfast", "Wed breakfast"),
      meal(2, "lunch", "Wed lunch"),
      meal(4, "dinner", "Fri dinner"),
    ];
    const { frozen, adjustable } = partitionMeals(meals, {
      day: 2,
      slot: "lunch",
    });
    expect(frozen.map((m) => m.title)).toEqual(["Mon dinner", "Wed breakfast"]);
    expect(adjustable.map((m) => m.title)).toEqual(["Wed lunch", "Fri dinner"]);
  });
});
