import { describe, it, expect } from "vitest";
import { householdServings, scaleIngredient } from "../../src/domain/portions.js";
import type { HouseholdMember, Ingredient } from "../../src/domain/types.js";

const household: HouseholdMember[] = [
  { id: "a1", type: "adult", appetite: "hearty" },
  { id: "a2", type: "adult", appetite: "hearty" },
  { id: "c1", type: "child", appetite: "standard" },
];

describe("householdServings", () => {
  it("sums appetite factors and rounds up to whole servings", () => {
    // adult hearty 1.2 x2 + child standard 0.5 = 2.9 -> 3 (round up so nobody goes hungry)
    expect(householdServings(household)).toBe(3);
  });

  it("handles a single standard adult (factor 1.0 -> 1 serving)", () => {
    expect(
      householdServings([{ id: "s1", type: "adult", appetite: "standard" }]),
    ).toBe(1);
  });

  it("rounds a very-active pair up", () => {
    // 1.4 + 1.4 = 2.8 -> 3
    expect(
      householdServings([
        { id: "a1", type: "adult", appetite: "very_active" },
        { id: "a2", type: "adult", appetite: "very_active" },
      ]),
    ).toBe(3);
  });
});

describe("scaleIngredient", () => {
  it("multiplies the per-serving quantity by the serving count", () => {
    const rice: Ingredient = { name: "rice", quantity: 60, unit: "g", category: "grains" };
    expect(scaleIngredient(rice, 3)).toEqual({
      name: "rice",
      quantity: 180,
      unit: "g",
      category: "grains",
    });
  });

  it("does not mutate the input", () => {
    const egg: Ingredient = { name: "egg", quantity: 1, unit: "piece", category: "dairy" };
    scaleIngredient(egg, 3);
    expect(egg.quantity).toBe(1);
  });

  it("scales cupQuantity (per-serving) too and carries cupUnit through", () => {
    const flour: Ingredient = {
      name: "flour",
      quantity: 40,
      unit: "g",
      category: "pantry",
      cupQuantity: 0.25,
      cupUnit: "cup",
    };
    expect(scaleIngredient(flour, 3)).toEqual({
      name: "flour",
      quantity: 120,
      unit: "g",
      category: "pantry",
      cupQuantity: 0.75,
      cupUnit: "cup",
    });
  });
});
