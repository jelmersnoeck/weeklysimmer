import { describe, it, expect } from "vitest";
import {
  buildShoppingList,
  consolidateShoppingList,
  excludeOnHand,
} from "../../src/domain/shopping.js";
import type { Meal, Ingredient, ShoppingItem } from "../../src/domain/types.js";

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

  it("merges singular and plural spellings of the same ingredient", () => {
    const meals = [
      meal([{ name: "egg", quantity: 2, unit: "piece", category: "dairy" }]),
      meal([{ name: "eggs", quantity: 3, unit: "piece", category: "dairy" }]),
    ];
    const list = buildShoppingList(meals);
    expect(list).toHaveLength(1);
    expect(list[0].totalQuantity).toBe(5);
    // first-seen display name is kept
    expect(list[0].name).toBe("egg");
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

  it("sums cupQuantity across the same ingredient sharing a cup unit", () => {
    const meals = [
      meal([{ name: "flour", quantity: 120, unit: "g", category: "pantry", cupQuantity: 1, cupUnit: "cup" }]),
      meal([{ name: "flour", quantity: 60, unit: "g", category: "pantry", cupQuantity: 0.5, cupUnit: "cup" }]),
    ];
    const list = buildShoppingList(meals);
    expect(list).toHaveLength(1);
    expect(list[0].totalQuantity).toBe(180);
    expect(list[0].cupQuantity).toBe(1.5);
    expect(list[0].cupUnit).toBe("cup");
  });

  it("omits cup fields entirely when no ingredient carries them", () => {
    const meals = [
      meal([{ name: "rice", quantity: 100, unit: "g", category: "grains" }]),
    ];
    const item = buildShoppingList(meals)[0];
    expect(item.cupQuantity).toBeUndefined();
    expect(item.cupUnit).toBeUndefined();
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

/** Terse ShoppingItem factory for consolidation tests. */
function item(overrides: Partial<ShoppingItem> & { name: string }): ShoppingItem {
  return {
    totalQuantity: 100,
    unit: "g",
    category: "grains",
    checked: false,
    ...overrides,
  };
}

describe("consolidateShoppingList", () => {
  it("merges same-canonical lines and keeps distinct products separate", () => {
    const items: ShoppingItem[] = [
      item({ name: "cooked rice", totalQuantity: 450, category: "bulk_staples" }),
      item({ name: "jasmine rice", totalQuantity: 900, category: "bulk_staples" }),
      item({ name: "brown rice", totalQuantity: 200, category: "bulk_staples" }),
    ];
    const mapping = [
      { name: "cooked rice", canonical: "rice" },
      { name: "jasmine rice", canonical: "rice" },
      { name: "brown rice", canonical: "brown rice" },
    ];

    const result = consolidateShoppingList(items, mapping);

    expect(result).toHaveLength(2);
    const rice = result.find((i) => i.name === "rice")!;
    expect(rice.totalQuantity).toBe(1350);
    expect(rice.unit).toBe("g");
    expect(rice.category).toBe("bulk_staples");
    expect(rice.checked).toBe(false);
    const brown = result.find((i) => i.name === "brown rice")!;
    expect(brown.totalQuantity).toBe(200);
  });

  it("keeps an item's own name when it is absent from the mapping", () => {
    const items: ShoppingItem[] = [
      item({ name: "rice", totalQuantity: 300, category: "bulk_staples" }),
      item({ name: "chicken", totalQuantity: 400, category: "meat" }),
    ];
    // only rice is in the mapping; chicken must fall back to itself
    const result = consolidateShoppingList(items, [
      { name: "rice", canonical: "rice" },
    ]);
    expect(result.map((i) => i.name).sort()).toEqual(["chicken", "rice"]);
    expect(result.find((i) => i.name === "chicken")!.totalQuantity).toBe(400);
  });

  it("re-merges convertible units in the base unit within a canonical group", () => {
    const items: ShoppingItem[] = [
      item({ name: "cooked rice", totalQuantity: 1, unit: "kg", category: "bulk_staples" }),
      item({ name: "jasmine rice", totalQuantity: 200, unit: "g", category: "bulk_staples" }),
    ];
    const result = consolidateShoppingList(items, [
      { name: "cooked rice", canonical: "rice" },
      { name: "jasmine rice", canonical: "rice" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("rice");
    expect(result[0].totalQuantity).toBe(1200);
    expect(result[0].unit).toBe("g");
  });

  it("keeps incompatible units under one canonical as separate lines", () => {
    const items: ShoppingItem[] = [
      item({ name: "minced garlic", totalQuantity: 3, unit: "clove", category: "produce" }),
      item({ name: "garlic", totalQuantity: 10, unit: "g", category: "produce" }),
    ];
    const result = consolidateShoppingList(items, [
      { name: "minced garlic", canonical: "garlic" },
      { name: "garlic", canonical: "garlic" },
    ]);
    expect(result).toHaveLength(2);
    expect(result.every((i) => i.name === "garlic")).toBe(true);
    expect(result.find((i) => i.unit === "clove")!.totalQuantity).toBe(3);
    expect(result.find((i) => i.unit === "g")!.totalQuantity).toBe(10);
  });

  it("sums cupQuantity across merged lines sharing a cup unit", () => {
    const items: ShoppingItem[] = [
      item({ name: "plain flour", totalQuantity: 120, unit: "g", category: "bulk_staples", cupQuantity: 1, cupUnit: "cup" }),
      item({ name: "flour", totalQuantity: 60, unit: "g", category: "bulk_staples", cupQuantity: 0.5, cupUnit: "cup" }),
    ];
    const result = consolidateShoppingList(items, [
      { name: "plain flour", canonical: "flour" },
      { name: "flour", canonical: "flour" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].totalQuantity).toBe(180);
    expect(result[0].cupQuantity).toBe(1.5);
    expect(result[0].cupUnit).toBe("cup");
  });

  it("matches item names case-insensitively against the mapping", () => {
    const items: ShoppingItem[] = [
      item({ name: "Cooked Rice", totalQuantity: 100, category: "bulk_staples" }),
      item({ name: "jasmine rice", totalQuantity: 50, category: "bulk_staples" }),
    ];
    const result = consolidateShoppingList(items, [
      { name: "cooked rice", canonical: "rice" },
      { name: "jasmine rice", canonical: "rice" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].totalQuantity).toBe(150);
  });
});

describe("excludeOnHand", () => {
  it("drops items the household already has, keeping the rest", () => {
    const items: ShoppingItem[] = [
      item({ name: "Carrots", category: "produce" }),
      item({ name: "rice", category: "bulk_staples" }),
      item({ name: "chicken", category: "meat" }),
    ];
    // carrot↔carrots (singularize) and rice↔jasmine rice (descriptor strip)
    const { toBuy, alreadyHave } = excludeOnHand(items, [
      "carrots",
      "jasmine rice",
      "spinach",
    ]);
    expect(toBuy.map((i) => i.name)).toEqual(["chicken"]);
    // only the two onHand terms that actually matched a line are reported
    expect(alreadyHave.sort()).toEqual(["carrots", "jasmine rice"]);
  });

  it("matches singular/plural spellings both ways", () => {
    const items: ShoppingItem[] = [item({ name: "carrots", category: "produce" })];
    expect(excludeOnHand(items, ["carrot"]).toBuy).toHaveLength(0);
    const items2: ShoppingItem[] = [item({ name: "carrot", category: "produce" })];
    expect(excludeOnHand(items2, ["carrots"]).toBuy).toHaveLength(0);
  });

  it("strips known prep/variety descriptors so 'baby spinach' matches 'spinach'", () => {
    const items: ShoppingItem[] = [item({ name: "baby spinach", category: "produce" })];
    expect(excludeOnHand(items, ["spinach"]).toBuy).toHaveLength(0);
  });

  it("does NOT drop 'sweet potato' when only 'potato' is on hand", () => {
    const items: ShoppingItem[] = [item({ name: "sweet potato", category: "produce" })];
    const { toBuy } = excludeOnHand(items, ["potato"]);
    expect(toBuy.map((i) => i.name)).toEqual(["sweet potato"]);
  });

  it("does NOT drop 'brown rice' when only 'rice' is on hand", () => {
    const items: ShoppingItem[] = [item({ name: "brown rice", category: "bulk_staples" })];
    const { toBuy } = excludeOnHand(items, ["rice"]);
    expect(toBuy.map((i) => i.name)).toEqual(["brown rice"]);
  });

  it("does NOT drop 'spring onion' when only 'onion' is on hand", () => {
    const items: ShoppingItem[] = [item({ name: "spring onion", category: "produce" })];
    const { toBuy } = excludeOnHand(items, ["onion"]);
    expect(toBuy.map((i) => i.name)).toEqual(["spring onion"]);
  });

  it("ignores blank onHand terms and returns everything to buy", () => {
    const items: ShoppingItem[] = [item({ name: "chicken", category: "meat" })];
    const { toBuy, alreadyHave } = excludeOnHand(items, ["", "  "]);
    expect(toBuy).toHaveLength(1);
    expect(alreadyHave).toHaveLength(0);
  });
});
