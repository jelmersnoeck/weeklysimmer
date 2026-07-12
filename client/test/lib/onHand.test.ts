import { describe, expect, test } from "vitest";
import type { Meal } from "../../src/types";
import { mealUsesOnHand, parseOnHand } from "../../src/lib/onHand";

function makeMeal(names: string[]): Meal {
  return {
    id: 1,
    day: 0,
    slot: "dinner",
    title: "Test meal",
    cuisine: "British",
    proteinClass: "vegetarian",
    base: "bowl",
    difficulty: "easy",
    ingredients: names.map((name) => ({
      name,
      quantity: 1,
      unit: "pcs",
      category: "Produce",
    })),
    steps: [],
    leftoverOf: null,
    rating: null,
  };
}

describe("parseOnHand", () => {
  test("splits on newlines", () => {
    expect(parseOnHand("leek\nkale\ncarrots")).toEqual([
      "leek",
      "kale",
      "carrots",
    ]);
  });

  test("splits on commas", () => {
    expect(parseOnHand("leek, kale, carrots")).toEqual([
      "leek",
      "kale",
      "carrots",
    ]);
  });

  test("splits on a mix of newlines and commas", () => {
    expect(parseOnHand("half a cabbage, leftover rice\n2 carrots")).toEqual([
      "half a cabbage",
      "leftover rice",
      "2 carrots",
    ]);
  });

  test("trims whitespace and drops blank lines", () => {
    expect(parseOnHand("  leek  \n\n  ,  , kale \n")).toEqual(["leek", "kale"]);
  });

  test("dedupes case-insensitively, keeping the first spelling", () => {
    expect(parseOnHand("Leek\nleek, LEEK, Kale")).toEqual(["Leek", "Kale"]);
  });

  test("returns an empty array for blank input", () => {
    expect(parseOnHand("")).toEqual([]);
    expect(parseOnHand("   \n , \n ")).toEqual([]);
  });
});

describe("mealUsesOnHand", () => {
  test("matches an on-hand item against a plural ingredient name", () => {
    const meal = makeMeal(["Carrots", "Onion", "Rice"]);
    expect(mealUsesOnHand(meal, ["carrot", "spinach"])).toEqual(["carrot"]);
  });

  test("returns every on-hand item the meal uses", () => {
    const meal = makeMeal(["Carrots", "Spinach", "Garlic"]);
    expect(mealUsesOnHand(meal, ["carrot", "spinach", "rice"])).toEqual([
      "carrot",
      "spinach",
    ]);
  });

  test("returns an empty array when the meal uses none of them", () => {
    const meal = makeMeal(["Chicken", "Potato"]);
    expect(mealUsesOnHand(meal, ["carrot", "rice"])).toEqual([]);
  });

  test("empty on-hand list yields no matches", () => {
    const meal = makeMeal(["Carrots"]);
    expect(mealUsesOnHand(meal, [])).toEqual([]);
  });
});
