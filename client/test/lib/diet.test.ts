import { describe, expect, test } from "vitest";
import type { Diet, Settings } from "../../src/types";
import { dietConflicts } from "../../src/lib/diet";
import { SLOT_ORDER } from "../../src/lib/meal";

function base(overrides: Partial<Settings> = {}): Settings {
  return {
    configured: true,
    household: [{ id: "a1", type: "adult", appetite: "standard" }],
    proteins: [],
    vegetablesLiked: [],
    fruitsLiked: [],
    cuisinesLiked: [],
    dishTypesLiked: [],
    flavoursLiked: [],
    avoid: [],
    diets: [],
    units: ["metric"],
    effort: "medium",
    personalNote: "",
    mealSchedule: Object.fromEntries(
      SLOT_ORDER.map((s) => [s, Array(7).fill(true)]),
    ) as Settings["mealSchedule"],
    ...overrides,
  };
}

function withDiet(diet: Diet, overrides: Partial<Settings> = {}): Settings {
  return base({ diets: [diet], ...overrides });
}

describe("dietConflicts", () => {
  test("no diets selected yields no conflicts even with meat selected", () => {
    const s = base({
      diets: [],
      proteins: [{ key: "beef", frequency: "weekly" }],
    });
    expect(dietConflicts(s)).toEqual([]);
  });

  test("a protein set to never is not counted as selected", () => {
    const s = withDiet("vegetarian", {
      proteins: [{ key: "chicken", frequency: "never" }],
    });
    expect(dietConflicts(s)).toEqual([]);
  });

  test("vegetarian flags selected meat and fish", () => {
    const s = withDiet("vegetarian", {
      proteins: [
        { key: "chicken", frequency: "often" },
        { key: "white_fish", frequency: "weekly" },
        { key: "tofu", frequency: "weekly" },
      ],
    });
    const c = dietConflicts(s);
    expect(c).toContainEqual({
      field: "proteins",
      key: "chicken",
      message: "Chicken isn't vegetarian",
    });
    expect(c).toContainEqual({
      field: "proteins",
      key: "white_fish",
      message: "White fish isn't vegetarian",
    });
    expect(c.find((x) => x.key === "tofu")).toBeUndefined();
  });

  test("vegan flags meat/fish, eggs, halloumi and cheesy flavour", () => {
    const s = withDiet("vegan", {
      proteins: [
        { key: "beef", frequency: "weekly" },
        { key: "eggs", frequency: "weekly" },
        { key: "halloumi_paneer", frequency: "occasionally" },
      ],
      flavoursLiked: ["cheesy"],
    });
    const c = dietConflicts(s);
    expect(c).toContainEqual({
      field: "proteins",
      key: "eggs",
      message: "Eggs isn't vegan",
    });
    expect(c).toContainEqual({
      field: "proteins",
      key: "halloumi_paneer",
      message: "Halloumi / paneer isn't vegan",
    });
    expect(c).toContainEqual({
      field: "flavours",
      key: "cheesy",
      message: "Cheese isn't vegan",
    });
  });

  test("pescatarian flags land meat only", () => {
    const s = withDiet("pescatarian", {
      proteins: [
        { key: "beef", frequency: "weekly" },
        { key: "salmon", frequency: "weekly" },
      ],
    });
    const c = dietConflicts(s);
    expect(c).toContainEqual({
      field: "proteins",
      key: "beef",
      message: "Beef isn't pescatarian",
    });
    expect(c.find((x) => x.key === "salmon")).toBeUndefined();
  });

  test("low_fodmap flags beans and garlicky flavour", () => {
    const s = withDiet("low_fodmap", {
      proteins: [{ key: "beans_legumes", frequency: "weekly" }],
      flavoursLiked: ["garlicky"],
    });
    expect(dietConflicts(s)).toEqual([
      {
        field: "proteins",
        key: "beans_legumes",
        message: "Beans are high-FODMAP",
      },
      {
        field: "flavours",
        key: "garlicky",
        message: "Garlic is high-FODMAP",
      },
    ]);
  });

  test("unions conflicts across multiple selected diets", () => {
    const s = base({
      diets: ["vegetarian", "low_fodmap"],
      proteins: [
        { key: "chicken", frequency: "weekly" },
        { key: "beans_legumes", frequency: "weekly" },
      ],
      flavoursLiked: ["garlicky"],
    });
    const c = dietConflicts(s);
    // Vegetarian flags chicken; low_fodmap flags beans and garlicky.
    expect(c).toContainEqual({
      field: "proteins",
      key: "chicken",
      message: "Chicken isn't vegetarian",
    });
    expect(c).toContainEqual({
      field: "proteins",
      key: "beans_legumes",
      message: "Beans are high-FODMAP",
    });
    expect(c).toContainEqual({
      field: "flavours",
      key: "garlicky",
      message: "Garlic is high-FODMAP",
    });
  });

  test("dedupes a conflict shared by two selected diets by field|key", () => {
    // Both vegetarian and vegan flag chicken; it should appear only once.
    const s = base({
      diets: ["vegetarian", "vegan"],
      proteins: [{ key: "chicken", frequency: "weekly" }],
    });
    const c = dietConflicts(s);
    const chickenConflicts = c.filter((x) => x.key === "chicken");
    expect(chickenConflicts).toHaveLength(1);
    // The first-selected diet (vegetarian) wins the message.
    expect(chickenConflicts[0].message).toBe("Chicken isn't vegetarian");
  });
});
