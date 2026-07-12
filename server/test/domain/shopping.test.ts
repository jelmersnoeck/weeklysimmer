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
      // rice is a bulk staple, so its aisle is canonicalized to bulk_staples
      { name: "rice", totalQuantity: 360, unit: "g", category: "bulk_staples", checked: false },
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

  it("reclassifies shelf-stable staples into the bulk_staples category", () => {
    const meals = [
      meal([
        { name: "basmati rice", quantity: 60, unit: "g", category: "grains" },
        { name: "penne pasta", quantity: 80, unit: "g", category: "grains" },
        { name: "canned tuna", quantity: 100, unit: "g", category: "fish" },
      ]),
    ];
    const list = buildShoppingList(meals);
    for (const name of ["basmati rice", "penne pasta", "canned tuna"]) {
      expect(list.find((i) => i.name === name)!.category).toBe("bulk_staples");
    }
  });

  it("leaves perishable ingredients' categories unchanged", () => {
    const meals = [
      meal([
        { name: "chicken breast", quantity: 150, unit: "g", category: "meat" },
        { name: "olive oil", quantity: 15, unit: "ml", category: "pantry" },
      ]),
    ];
    const list = buildShoppingList(meals);
    expect(list.find((i) => i.name === "chicken breast")!.category).toBe("meat");
    expect(list.find((i) => i.name === "olive oil")!.category).toBe("pantry");
  });

  it("merges rice variants by name and lands them in bulk_staples", () => {
    const meals = [
      meal([{ name: "cooked rice", quantity: 100, unit: "g", category: "grains" }]),
      meal([{ name: "cooked rice", quantity: 50, unit: "g", category: "grains" }]),
      meal([{ name: "jasmine rice", quantity: 60, unit: "g", category: "grains" }]),
    ];
    const list = buildShoppingList(meals);
    const cooked = list.find((i) => i.name === "cooked rice")!;
    expect(cooked.totalQuantity).toBe(150);
    expect(cooked.category).toBe("bulk_staples");
    const jasmine = list.find((i) => i.name === "jasmine rice")!;
    expect(jasmine.category).toBe("bulk_staples");
    // both sit under the same aisle
    expect(list.every((i) => i.category === "bulk_staples")).toBe(true);
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
