import { describe, it, expect } from "vitest";
import { buildCurationPrompt, buildRegeneratePrompt } from "../../src/llm/prompt.js";
import {
  defaultMealSchedule,
  enabledSlotsFromSchedule,
} from "../../src/domain/schedule.js";
import { makeSettings } from "../helpers/settings.js";
import type { Meal } from "../../src/domain/types.js";

const settings = makeSettings();

const input = {
  settings,
  weekStart: "2026-07-13",
  onHand: ["carrots", "leek", "spinach"],
  note: "prefer lighter meals this week",
  avoid: ["Lemon chicken with rice", "Tuna pasta bake"],
  enabledSlots: enabledSlotsFromSchedule(defaultMealSchedule()),
};

describe("buildCurationPrompt", () => {
  const prompt = buildCurationPrompt(input);

  it("includes every on-hand item", () => {
    for (const food of input.onHand) {
      expect(prompt).toContain(food);
    }
  });

  it("instructs to build the week around using up on-hand foods / minimize waste", () => {
    expect(prompt.toLowerCase()).toContain("use up");
    expect(prompt.toLowerCase()).toContain("already has");
    expect(prompt.toLowerCase()).toContain("waste");
    // no lingering "veg box" wording after generalization
    expect(prompt.toLowerCase()).not.toContain("veg box");
  });

  it("states the household avoid-list as strict excludes", () => {
    // default profile avoids "spicy"
    expect(prompt).toContain("spicy");
    expect(prompt.toLowerCase()).toContain("exclude");
    expect(prompt.toLowerCase()).toContain("avoid");
  });

  it("states the diet as a guide", () => {
    expect(prompt).toContain("low_fodmap");
    expect(prompt.toLowerCase()).toContain("diet");
    // explicit selections take precedence over the diet label
    expect(prompt.toLowerCase()).toContain("precedence");
  });

  it("weights proteins by frequency and excludes 'never' proteins", () => {
    const lower = prompt.toLowerCase();
    // an "often" protein from the default profile
    expect(prompt).toContain("chicken");
    expect(lower).toContain("often");
    expect(lower).toContain("weekly");
    // a "never" protein is listed in the EXCLUDE line
    const excludeLine = prompt
      .split("\n")
      .find((l) => l.toLowerCase().includes("exclude these proteins"))!;
    expect(excludeLine).toContain("pork");
    // and a frequently-used protein is NOT in the exclude line
    expect(excludeLine).not.toContain("chicken");
  });

  it("leans toward liked cuisines, dish types and flavours", () => {
    // default profile likes mediterranean cuisine, stir_fry dishes, umami flavour
    expect(prompt).toContain("mediterranean");
    expect(prompt).toContain("stir_fry");
    expect(prompt).toContain("umami");
    expect(prompt.toLowerCase()).toContain("lean toward");
  });

  it("states the household serving count", () => {
    // default household = adult hearty x2 (2.4) + child standard (0.5) = 2.9 -> 3
    expect(prompt).toContain("3 servings");
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

  it("enumerates all enabled day/slot pairs (35 when the full week is enabled) with web search + sourceUrl", () => {
    // full default schedule = 35 cells
    expect(prompt).toContain("35");
    // per-day enumeration with day names and indices
    expect(prompt).toContain("Monday (day 0)");
    expect(prompt).toContain("Sunday (day 6)");
    // each day lists all five slots
    expect(prompt).toContain("breakfast, morning_snack, lunch, afternoon_snack, dinner");
    expect(prompt.toLowerCase()).toContain("web search");
    expect(prompt).toContain("sourceUrl");
  });

  it("lists ONLY the enabled cells, omitting disabled slots and counting them", () => {
    const subsetPrompt = buildCurationPrompt({
      ...input,
      enabledSlots: [
        { day: 0, slot: "lunch" },
        { day: 0, slot: "dinner" },
        { day: 1, slot: "dinner" },
      ],
    });
    // count reflects the enabled cells, not a fixed 35
    expect(subsetPrompt).toContain("3 meals");
    expect(subsetPrompt).not.toContain("35 meals");
    // exact per-day lines: Monday omits its disabled breakfast/snacks
    expect(subsetPrompt).toContain("Monday (day 0): lunch, dinner");
    expect(subsetPrompt).toContain("Tuesday (day 1): dinner");
    // no enumeration line for days with no enabled cells
    expect(subsetPrompt).not.toContain("(day 2)");
    expect(subsetPrompt).not.toContain("Wednesday (day 2)");
  });

  it("names both snack slots and describes two simple no-cook snacks per day", () => {
    expect(prompt).toContain("morning_snack");
    expect(prompt).toContain("afternoon_snack");
    const lower = prompt.toLowerCase();
    expect(lower).toContain("snack");
    expect(lower).toMatch(/no-cook|minimal prep/);
  });

  it("asks for prep and cook time on every meal", () => {
    expect(prompt).toContain("prepMinutes");
    expect(prompt).toContain("cookMinutes");
  });

  it("asks for per-serving calories on every meal", () => {
    expect(prompt).toContain("caloriesPerServing");
    expect(prompt.toLowerCase()).toContain("per one serving");
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
    proteinClass: "lean" as const,
    onHand: ["carrots", "leek"],
    note: "lighter please",
    otherMeals,
  };

  const prompt = buildRegeneratePrompt(regenInput);

  it("requires the replacement to keep the slot's protein class", () => {
    const vegPrompt = buildRegeneratePrompt({
      ...regenInput,
      proteinClass: "vegetarian",
    });
    expect(vegPrompt.toLowerCase()).toContain("vegetarian");
    // instructs the replacement MUST also be that class
    expect(vegPrompt.toLowerCase()).toMatch(/must also be|must be|protein balance/);
    expect(vegPrompt.toLowerCase()).toContain("protein");
  });

  it("names the target day and slot", () => {
    expect(prompt.toLowerCase()).toContain("dinner");
    // day 2 referenced explicitly
    expect(prompt).toContain("2");
  });

  it("states the standing constraints (avoid-list, diet, protein class, easy ~30 min)", () => {
    const lower = prompt.toLowerCase();
    // default profile avoids "spicy" and follows the low_fodmap diet
    expect(prompt).toContain("spicy");
    expect(prompt).toContain("low_fodmap");
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

  it("includes the on-hand foods and note", () => {
    expect(prompt).toContain("carrots");
    expect(prompt).toContain(regenInput.note);
  });

  it("asks for prep and cook time in the single-meal output", () => {
    expect(prompt).toContain("prepMinutes");
    expect(prompt).toContain("cookMinutes");
  });

  it("asks for per-serving calories in the single-meal output", () => {
    expect(prompt).toContain("caloriesPerServing");
  });

  it("works for a snack target slot", () => {
    const snackPrompt = buildRegeneratePrompt({
      ...regenInput,
      slot: "afternoon_snack",
    });
    expect(snackPrompt).toContain("afternoon_snack");
    expect(snackPrompt.toLowerCase()).toContain("snack");
    expect(snackPrompt).toContain("prepMinutes");
  });

  it("is a non-trivial pure string", () => {
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(150);
  });
});
