import { describe, it, expect } from "vitest";
import {
  planSchema,
  rawMealSchema,
  adjustResultSchema,
} from "../../src/llm/planSchema.js";

const validMeal = {
  day: 0,
  slot: "dinner" as const,
  title: "Lemon chicken with rice",
  cuisine: "mediterranean",
  proteinClass: "lean" as const,
  base: "rice",
  difficulty: "easy" as const,
  prepMinutes: 10,
  cookMinutes: 20,
  caloriesPerServing: 520,
  ingredients: [
    { name: "chicken breast", quantity: 150, unit: "g", category: "meat" },
    { name: "rice", quantity: 60, unit: "g", category: "grains" },
  ],
  steps: ["Cook the rice.", "Pan-fry the chicken."],
  sourceUrl: "https://example.com/recipe",
  leftoverOf: null,
};

describe("planSchema", () => {
  it("accepts a well-formed plan", () => {
    const plan = { meals: [validMeal] };
    const parsed = planSchema.parse(plan);
    expect(parsed.meals).toHaveLength(1);
    expect(parsed.meals[0].title).toBe("Lemon chicken with rice");
  });

  it("rejects a meal missing slot", () => {
    const { slot, ...noSlot } = validMeal;
    expect(() => rawMealSchema.parse(noSlot)).toThrow();
  });

  it("accepts the two snack slots", () => {
    for (const slot of ["morning_snack", "afternoon_snack"] as const) {
      const parsed = rawMealSchema.parse({ ...validMeal, slot });
      expect(parsed.slot).toBe(slot);
    }
  });

  it("rejects a slot outside the enum", () => {
    expect(() => rawMealSchema.parse({ ...validMeal, slot: "brunch" })).toThrow();
  });

  it("accepts prep and cook minutes and rejects when either is missing", () => {
    const parsed = rawMealSchema.parse(validMeal);
    expect(parsed.prepMinutes).toBe(10);
    expect(parsed.cookMinutes).toBe(20);

    const { prepMinutes, ...noPrep } = validMeal;
    expect(() => rawMealSchema.parse(noPrep)).toThrow();
    const { cookMinutes, ...noCook } = validMeal;
    expect(() => rawMealSchema.parse(noCook)).toThrow();
    // a no-cook snack (cookMinutes: 0) is valid
    expect(
      rawMealSchema.parse({ ...validMeal, slot: "morning_snack", cookMinutes: 0 })
        .cookMinutes,
    ).toBe(0);
    // negative minutes rejected
    expect(() => rawMealSchema.parse({ ...validMeal, prepMinutes: -1 })).toThrow();
  });

  it("requires an integer caloriesPerServing and rejects missing/negative/float", () => {
    expect(rawMealSchema.parse(validMeal).caloriesPerServing).toBe(520);
    const { caloriesPerServing, ...noCals } = validMeal;
    expect(() => rawMealSchema.parse(noCals)).toThrow();
    expect(() =>
      rawMealSchema.parse({ ...validMeal, caloriesPerServing: -1 }),
    ).toThrow();
    expect(() =>
      rawMealSchema.parse({ ...validMeal, caloriesPerServing: 12.5 }),
    ).toThrow();
    // zero kcal is allowed (e.g. water)
    expect(
      rawMealSchema.parse({ ...validMeal, caloriesPerServing: 0 })
        .caloriesPerServing,
    ).toBe(0);
  });

  it("accepts an ingredient with optional cupQuantity/cupUnit", () => {
    const withCups = {
      ...validMeal,
      ingredients: [
        { name: "flour", quantity: 120, unit: "g", category: "grains", cupQuantity: 1, cupUnit: "cup" },
      ],
    };
    const parsed = rawMealSchema.parse(withCups);
    expect(parsed.ingredients[0].cupQuantity).toBe(1);
    expect(parsed.ingredients[0].cupUnit).toBe("cup");
  });

  it("accepts an ingredient WITHOUT cup fields (they stay optional)", () => {
    const parsed = rawMealSchema.parse(validMeal);
    expect(parsed.ingredients[0].cupQuantity).toBeUndefined();
    expect(parsed.ingredients[0].cupUnit).toBeUndefined();
  });

  it("rejects a negative cupQuantity", () => {
    const bad = {
      ...validMeal,
      ingredients: [
        { name: "flour", quantity: 120, unit: "g", category: "grains", cupQuantity: -1, cupUnit: "cup" },
      ],
    };
    expect(() => rawMealSchema.parse(bad)).toThrow();
  });

  it("rejects a negative ingredient quantity", () => {
    const bad = {
      ...validMeal,
      ingredients: [{ name: "rice", quantity: -1, unit: "g", category: "grains" }],
    };
    expect(() => rawMealSchema.parse(bad)).toThrow();
  });

  it("rejects a proteinClass outside the enum", () => {
    const bad = { ...validMeal, proteinClass: "fishy" };
    expect(() => rawMealSchema.parse(bad)).toThrow();
  });

  it("rejects non-array steps", () => {
    const bad = { ...validMeal, steps: "just cook it" };
    expect(() => rawMealSchema.parse(bad)).toThrow();
  });

  it("keeps leftoverOf: null after parse", () => {
    const parsed = rawMealSchema.parse(validMeal);
    expect(parsed.leftoverOf).toBeNull();
  });

  it("accepts a linked leftoverOf reference", () => {
    const lunch = {
      ...validMeal,
      slot: "lunch" as const,
      leftoverOf: { day: 0, slot: "dinner" as const },
    };
    const parsed = rawMealSchema.parse(lunch);
    expect(parsed.leftoverOf).toEqual({ day: 0, slot: "dinner" });
  });

  it("rejects an empty meals array", () => {
    expect(() => planSchema.parse({ meals: [] })).toThrow();
  });
});

describe("adjustResultSchema", () => {
  it("accepts a change set with replacements and removals", () => {
    const parsed = adjustResultSchema.parse({
      changes: [validMeal],
      removals: [{ day: 3, slot: "dinner" }],
    });
    expect(parsed.changes).toHaveLength(1);
    expect(parsed.removals).toEqual([{ day: 3, slot: "dinner" }]);
  });

  it("accepts empty change and removal arrays", () => {
    const parsed = adjustResultSchema.parse({ changes: [], removals: [] });
    expect(parsed.changes).toHaveLength(0);
    expect(parsed.removals).toHaveLength(0);
  });

  it("rejects a removal with a bad slot", () => {
    expect(() =>
      adjustResultSchema.parse({
        changes: [],
        removals: [{ day: 0, slot: "brunch" }],
      }),
    ).toThrow();
  });
});
