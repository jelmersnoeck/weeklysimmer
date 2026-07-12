import { describe, it, expect } from "vitest";
import {
  PROTEINS,
  CUISINES,
  DISH_TYPES,
  FLAVOURS,
  AVOIDS,
  DIETS,
  VEGETABLES,
  FRUITS,
  FREQUENCIES,
  APPETITES,
  MEMBER_TYPES,
  APPETITE_FACTOR,
  memberFactor,
  defaultSettings,
} from "../../src/domain/preferences.js";

describe("preference option lists", () => {
  it("exports the canonical protein keys", () => {
    expect(PROTEINS).toEqual([
      "chicken",
      "turkey",
      "beef",
      "pork",
      "lamb",
      "white_fish",
      "salmon",
      "tuna",
      "shellfish",
      "eggs",
      "tofu",
      "beans_legumes",
      "halloumi_paneer",
    ]);
  });

  it("exports the canonical enum lists", () => {
    expect(FREQUENCIES).toEqual(["never", "occasionally", "weekly", "often"]);
    expect(APPETITES).toEqual(["light", "standard", "hearty", "very_active"]);
    expect(MEMBER_TYPES).toEqual(["adult", "child"]);
    expect(DIETS).toContain("low_fodmap");
    expect(DIETS).toContain("none");
    expect(CUISINES).toContain("mediterranean");
    expect(DISH_TYPES).toContain("stir_fry");
    expect(FLAVOURS).toContain("umami");
    expect(AVOIDS).toContain("spicy");
    expect(VEGETABLES).toContain("courgette");
    expect(FRUITS).toContain("berries");
  });
});

describe("APPETITE_FACTOR / memberFactor", () => {
  it("maps type+appetite to the right factor", () => {
    expect(APPETITE_FACTOR.adult.hearty).toBe(1.2);
    expect(APPETITE_FACTOR.child.standard).toBe(0.5);
    expect(memberFactor({ id: "x", type: "adult", appetite: "very_active" })).toBe(1.4);
    expect(memberFactor({ id: "y", type: "child", appetite: "light" })).toBe(0.4);
  });
});

describe("defaultSettings", () => {
  const s = defaultSettings();

  it("is unconfigured", () => {
    expect(s.configured).toBe(false);
  });

  it("has 2 hearty adults and 1 standard child", () => {
    expect(s.household).toEqual([
      { id: "a1", type: "adult", appetite: "hearty" },
      { id: "a2", type: "adult", appetite: "hearty" },
      { id: "c1", type: "child", appetite: "standard" },
    ]);
  });

  it("prefills protein frequencies", () => {
    const freq = (k: string) => s.proteins.find((p) => p.key === k)?.frequency;
    expect(freq("chicken")).toBe("often");
    expect(freq("white_fish")).toBe("weekly");
    expect(freq("salmon")).toBe("weekly");
    expect(freq("tuna")).toBe("weekly");
    expect(freq("eggs")).toBe("weekly");
    expect(freq("turkey")).toBe("occasionally");
    expect(freq("tofu")).toBe("occasionally");
    expect(freq("beef")).toBe("occasionally");
    expect(freq("beans_legumes")).toBe("never");
    expect(freq("pork")).toBe("never");
    // every canonical protein has an entry
    expect(s.proteins).toHaveLength(PROTEINS.length);
  });

  it("sets the default diet, avoid and liked lists", () => {
    expect(s.diet).toBe("low_fodmap");
    expect(s.avoid).toEqual(["spicy"]);
    expect(s.cuisinesLiked).toContain("mediterranean");
    expect(s.dishTypesLiked).toContain("stir_fry");
    expect(s.flavoursLiked).toEqual(["savoury", "herby", "umami", "creamy"]);
    expect(s.vegetablesLiked).toContain("broccoli");
    expect(s.fruitsLiked).toEqual(["apple", "banana", "berries", "citrus"]);
    expect(s.effort).toBe("easy");
  });

  it("defaults the meal schedule to all-true (5 slots x 7 days)", () => {
    const weeks = Object.values(s.mealSchedule);
    expect(weeks).toHaveLength(5);
    for (const w of weeks) {
      expect(w).toEqual([true, true, true, true, true, true, true]);
    }
  });
});
