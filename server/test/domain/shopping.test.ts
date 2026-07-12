import { describe, it, expect } from "vitest";
import { buildShoppingList } from "../../src/domain/shopping.js";
import type { Meal, Ingredient } from "../../src/domain/types.js";

// Minimal meal factory — only ingredients matter for the shopping list.
function meal(ingredients: Ingredient[], overrides: Partial<Meal> = {}): Meal {
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
    ...overrides,
  };
}

describe("buildShoppingList", () => {
  it("sums the same ingredient across meals (same unit)", () => {
    const meals = [
      meal([{ name: "rice", quantity: 180, unit: "g", category: "grains" }]),
      meal([{ name: "rice", quantity: 180, unit: "g", category: "grains" }]),
    ];
    expect(buildShoppingList(meals)).toEqual([
      { name: "rice", totalQuantity: 360, unit: "g", category: "grains", checked: false },
    ]);
  });

  it("merges convertible units into the base unit", () => {
    const meals = [
      meal([{ name: "chicken", quantity: 1, unit: "kg", category: "meat" }]),
      meal([{ name: "chicken", quantity: 200, unit: "g", category: "meat" }]),
    ];
    expect(buildShoppingList(meals)).toEqual([
      { name: "chicken", totalQuantity: 1200, unit: "g", category: "meat", checked: false },
    ]);
  });

  it("merges matching count units but keeps incompatible units separate", () => {
    const meals = [
      meal([{ name: "garlic", quantity: 2, unit: "clove", category: "produce" }]),
      meal([{ name: "garlic", quantity: 1, unit: "clove", category: "produce" }]),
      meal([{ name: "garlic", quantity: 5, unit: "g", category: "produce" }]),
    ];
    const list = buildShoppingList(meals);
    expect(list).toContainEqual({
      name: "garlic", totalQuantity: 3, unit: "clove", category: "produce", checked: false,
    });
    expect(list).toContainEqual({
      name: "garlic", totalQuantity: 5, unit: "g", category: "produce", checked: false,
    });
    expect(list).toHaveLength(2);
  });

  it("is case-insensitive on ingredient name", () => {
    const meals = [
      meal([{ name: "Rice", quantity: 100, unit: "g", category: "grains" }]),
      meal([{ name: "rice", quantity: 50, unit: "g", category: "grains" }]),
    ];
    expect(buildShoppingList(meals)).toHaveLength(1);
    expect(buildShoppingList(meals)[0].totalQuantity).toBe(150);
  });

  it("excludes leftover meals (their food was already bought for the source meal)", () => {
    const meals = [
      meal([{ name: "chicken", quantity: 450, unit: "g", category: "meat" }]),
      meal(
        [{ name: "cooked chicken", quantity: 300, unit: "g", category: "meat" }],
        { day: 1, slot: "lunch", leftoverOf: { day: 0, slot: "dinner" } },
      ),
    ];
    // Only the source dinner's chicken is on the list; the leftover lunch adds nothing.
    expect(buildShoppingList(meals)).toEqual([
      { name: "chicken", totalQuantity: 450, unit: "g", category: "meat", checked: false },
    ]);
  });

  it("groups and sorts by category, then name", () => {
    const meals = [
      meal([
        { name: "tomato", quantity: 200, unit: "g", category: "produce" },
        { name: "chicken", quantity: 300, unit: "g", category: "meat" },
        { name: "apple", quantity: 2, unit: "piece", category: "produce" },
      ]),
    ];
    const list = buildShoppingList(meals);
    expect(list.map((i) => `${i.category}/${i.name}`)).toEqual([
      "meat/chicken",
      "produce/apple",
      "produce/tomato",
    ]);
  });
});
