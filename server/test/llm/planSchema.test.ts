import { describe, it, expect } from "vitest";
import { planSchema, rawMealSchema } from "../../src/llm/planSchema.js";

const validMeal = {
  day: 0,
  slot: "dinner" as const,
  title: "Lemon chicken with rice",
  cuisine: "mediterranean",
  proteinClass: "lean" as const,
  base: "rice",
  difficulty: "easy" as const,
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
