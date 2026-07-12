import { describe, it, expect } from "vitest";
import { householdServings, scaleIngredient } from "../../src/domain/portions.js";
import type { HouseholdMember, Ingredient } from "../../src/domain/types.js";

const household: HouseholdMember[] = [
  { label: "Adult A", consumptionFactor: 1.15 },
  { label: "Adult B", consumptionFactor: 1.15 },
  { label: "Toddler", consumptionFactor: 0.5 },
];

describe("householdServings", () => {
  it("sums consumption factors and rounds up to whole servings", () => {
    // 1.15 + 1.15 + 0.5 = 2.8 -> 3 servings (round up so nobody goes hungry)
    expect(householdServings(household)).toBe(3);
  });

  it("handles a single adult", () => {
    expect(householdServings([{ label: "Solo", consumptionFactor: 1.15 }])).toBe(2);
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
});
