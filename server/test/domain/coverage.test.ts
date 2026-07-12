import { describe, it, expect } from "vitest";
import { unusedVegetables } from "../../src/domain/coverage.js";
import type { Meal, Ingredient } from "../../src/domain/types.js";

function meal(ingredients: Ingredient[]): Meal {
  return {
    day: 0,
    slot: "dinner",
    title: "Test",
    cuisine: "test",
    proteinClass: "lean",
    base: "none",
    difficulty: "easy",
    ingredients,
    steps: [],
  };
}

function ing(name: string): Ingredient {
  return { name, quantity: 1, unit: "g", category: "produce" };
}

describe("unusedVegetables", () => {
  it("flags a delivered veg that no meal uses", () => {
    const meals = [meal([ing("carrot"), ing("chicken breast")])];
    expect(unusedVegetables(["carrots", "leek", "spinach"], meals)).toEqual([
      "leek",
      "spinach",
    ]);
  });

  it("matches across singular/plural and casing", () => {
    const meals = [meal([ing("Carrots"), ing("LEEK")])];
    expect(unusedVegetables(["carrot", "leek"], meals)).toEqual([]);
  });

  it("matches when the ingredient is a descriptive phrase containing the veg", () => {
    const meals = [meal([ing("baby spinach"), ing("grated carrot")])];
    expect(unusedVegetables(["spinach", "carrots"], meals)).toEqual([]);
  });

  it("returns everything when no meals use any box veg, preserving original spelling", () => {
    const meals = [meal([ing("rice"), ing("chicken")])];
    expect(unusedVegetables(["Courgette", "Bell Pepper"], meals)).toEqual([
      "Courgette",
      "Bell Pepper",
    ]);
  });

  it("returns nothing for an empty box", () => {
    expect(unusedVegetables([], [meal([ing("carrot")])])).toEqual([]);
  });

  it("matches -es / -oes plurals (tomatoes ↔ tomato, potatoes ↔ potato)", () => {
    const meals = [meal([ing("grated tomato"), ing("mashed potato")])];
    expect(unusedVegetables(["tomatoes", "potatoes"], meals)).toEqual([]);
  });

  it("does not falsely match on shared prefixes (peas must not match peanut)", () => {
    const meals = [meal([ing("peanut butter"), ing("cornstarch")])];
    expect(unusedVegetables(["peas", "corn"], meals)).toEqual(["peas", "corn"]);
  });
});
