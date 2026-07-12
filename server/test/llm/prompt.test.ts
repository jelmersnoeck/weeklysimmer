import { describe, it, expect } from "vitest";
import { buildCurationPrompt, buildRegeneratePrompt } from "../../src/llm/prompt.js";
import type { Settings, Meal } from "../../src/domain/types.js";

const settings: Settings = {
  members: [
    { label: "Adult A", consumptionFactor: 1.15 },
    { label: "Adult B", consumptionFactor: 1.15 },
    { label: "Toddler", consumptionFactor: 0.5 },
  ],
  restrictions: ["no_spicy", "low_fodmap"],
  avoidIngredients: ["beans", "lentils", "onion", "garlic"],
  proteinCadence: { veg_per_week: 1, red_or_high_fat_per_week: 1 },
  effort: "easy",
  defaultVegQuantities: {},
};

const input = {
  settings,
  weekStart: "2026-07-13",
  vegBox: ["carrots", "leek", "spinach"],
  note: "prefer lighter meals this week",
  avoid: ["Lemon chicken with rice", "Tuna pasta bake"],
};

describe("buildCurationPrompt", () => {
  const prompt = buildCurationPrompt(input);

  it("includes every veg-box item", () => {
    for (const veg of input.vegBox) {
      expect(prompt).toContain(veg);
    }
  });

  it("instructs to build the week around using up the veg box first / minimize waste", () => {
    expect(prompt.toLowerCase()).toContain("veg box");
    expect(prompt.toLowerCase()).toMatch(/using up|use up/);
    expect(prompt.toLowerCase()).toContain("waste");
  });

  it("states the restrictions as strict excludes", () => {
    expect(prompt.toLowerCase()).toContain("no_spicy");
    expect(prompt.toLowerCase()).toContain("low_fodmap");
    expect(prompt.toLowerCase()).toContain("exclude");
  });

  it("lists the avoid-ingredients from settings as excludes", () => {
    for (const ing of settings.avoidIngredients) {
      expect(prompt).toContain(ing);
    }
  });

  it("describes the protein cadence", () => {
    const lower = prompt.toLowerCase();
    expect(lower).toContain("vegetarian");
    expect(lower).toMatch(/red|high[- ]fat/);
    expect(lower).toContain("lean");
    // named lean proteins
    expect(lower).toContain("chicken");
    expect(lower).toContain("tuna");
    expect(lower).toContain("fish");
    expect(lower).toContain("turkey");
    expect(lower).toContain("eggs");
  });

  it("asks for easy ~30-minute dinners", () => {
    expect(prompt.toLowerCase()).toContain("30");
    expect(prompt.toLowerCase()).toContain("easy");
  });

  it("describes the leftovers / shared-base strategy and leftoverOf linking", () => {
    const lower = prompt.toLowerCase();
    expect(lower).toContain("leftover");
    expect(lower).toContain("leftoverof");
    expect(lower).toContain("shared base");
    expect(lower).toContain("breakfast");
    expect(lower).toContain("lunch");
    expect(lower).toContain("dinner");
  });

  it("lists the avoid-repeat meals", () => {
    for (const meal of input.avoid) {
      expect(prompt).toContain(meal);
    }
    expect(prompt.toLowerCase()).toContain("repeat");
  });

  it("requires 21 meals across 7 days x 3 slots and web search with sourceUrl", () => {
    expect(prompt).toContain("21");
    expect(prompt).toContain("7");
    expect(prompt.toLowerCase()).toContain("web search");
    expect(prompt).toContain("sourceUrl");
    // day range 0-6
    expect(prompt).toContain("0");
    expect(prompt).toContain("6");
  });

  it("specifies per-single-serving quantities, units and shopping categories", () => {
    const lower = prompt.toLowerCase();
    expect(lower).toContain("per single serving");
    expect(lower).toContain("category");
    // some example units
    expect(prompt).toContain("g");
    expect(prompt).toContain("ml");
    expect(prompt).toContain("clove");
    // some example categories
    expect(lower).toContain("produce");
    expect(lower).toContain("pantry");
  });

  it("includes the week start and note", () => {
    expect(prompt).toContain(input.weekStart);
    expect(prompt).toContain(input.note);
  });

  it("is a non-trivial pure string", () => {
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(200);
  });
});

describe("buildRegeneratePrompt", () => {
  const otherMeals: Meal[] = [
    {
      day: 2,
      slot: "dinner",
      title: "Lemon Chicken with Rice",
      cuisine: "mediterranean",
      proteinClass: "lean",
      base: "rice",
      difficulty: "easy",
      ingredients: [{ name: "chicken", quantity: 150, unit: "g", category: "meat" }],
      steps: ["Cook"],
    },
    {
      day: 3,
      slot: "dinner",
      title: "Tuna Pasta Bake",
      cuisine: "italian",
      proteinClass: "lean",
      base: "pasta",
      difficulty: "easy",
      ingredients: [{ name: "tuna", quantity: 100, unit: "g", category: "fish" }],
      steps: ["Bake"],
    },
  ];

  const regenInput = {
    settings,
    day: 2,
    slot: "dinner" as const,
    vegBox: ["carrots", "leek"],
    note: "lighter please",
    otherMeals,
  };

  const prompt = buildRegeneratePrompt(regenInput);

  it("names the target day and slot", () => {
    expect(prompt.toLowerCase()).toContain("dinner");
    // day 2 referenced explicitly
    expect(prompt).toContain("2");
  });

  it("states the standing constraints (no spicy, low-fodmap, lean protein, easy ~30 min)", () => {
    const lower = prompt.toLowerCase();
    expect(lower).toContain("no_spicy");
    expect(lower).toContain("low_fodmap");
    expect(lower).toContain("lean");
    expect(lower).toContain("30");
    expect(lower).toContain("easy");
  });

  it("asks for a meal different from / with variety versus the other meals", () => {
    const lower = prompt.toLowerCase();
    expect(lower).toMatch(/different|variety|vary/);
    // references the existing meals it must differ from
    expect(prompt).toContain("Lemon Chicken with Rice");
    expect(prompt).toContain("Tuna Pasta Bake");
  });

  it("includes the veg box and note", () => {
    expect(prompt).toContain("carrots");
    expect(prompt).toContain(regenInput.note);
  });

  it("is a non-trivial pure string", () => {
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(150);
  });
});
