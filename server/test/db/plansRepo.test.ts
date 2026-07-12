import { describe, it, expect } from "vitest";
import { openDb } from "../../src/db/index.js";
import {
  savePlan,
  getPlan,
  listPlans,
  rateMeal,
  updateMeal,
  saveShoppingItems,
  getShoppingItems,
} from "../../src/db/plansRepo.js";
import type { WeeklyPlan, Meal, ShoppingItem } from "../../src/domain/types.js";

function samplePlan(overrides: Partial<WeeklyPlan> = {}): WeeklyPlan {
  const dinner: Meal = {
    day: 0,
    slot: "dinner",
    title: "Chicken Rice",
    cuisine: "asian",
    proteinClass: "lean",
    base: "rice",
    difficulty: "easy",
    ingredients: [
      { name: "chicken", quantity: 150, unit: "g", category: "meat" },
      { name: "rice", quantity: 75, unit: "g", category: "pantry" },
    ],
    steps: ["Cook rice", "Cook chicken"],
    sourceUrl: "https://example.com/recipe",
    leftoverOf: null,
    rating: null,
  };
  const lunch: Meal = {
    day: 0,
    slot: "lunch",
    title: "Leftover Chicken Rice",
    cuisine: "asian",
    proteinClass: "lean",
    base: "rice",
    difficulty: "easy",
    ingredients: [],
    steps: [],
    leftoverOf: { day: 0, slot: "dinner" },
  };
  const breakfast: Meal = {
    day: 1,
    slot: "breakfast",
    title: "Oats",
    cuisine: "western",
    proteinClass: "vegetarian",
    base: "none",
    difficulty: "easy",
    ingredients: [{ name: "oats", quantity: 60, unit: "g", category: "pantry" }],
    steps: ["Boil oats"],
  };
  return {
    weekStart: "2026-07-13",
    onHand: ["carrot", "leek"],
    note: "test week",
    status: "draft",
    meals: [dinner, lunch, breakfast],
    ...overrides,
  };
}

describe("plansRepo", () => {
  it("saves and round-trips a plan with meals", () => {
    const db = openDb(":memory:");
    const id = savePlan(db, samplePlan());
    expect(typeof id).toBe("number");

    const plan = getPlan(db, id);
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe(id);
    expect(plan!.weekStart).toBe("2026-07-13");
    expect(plan!.onHand).toEqual(["carrot", "leek"]);
    expect(plan!.note).toBe("test week");
    expect(plan!.status).toBe("draft");
    expect(plan!.meals.length).toBe(3);

    // ordered by day then slot (breakfast<lunch<dinner)
    const order = plan!.meals.map((m) => `${m.day}:${m.slot}`);
    expect(order).toEqual(["0:lunch", "0:dinner", "1:breakfast"]);

    const dinner = plan!.meals.find((m) => m.slot === "dinner")!;
    expect(dinner.id).toBeTypeOf("number");
    expect(dinner.ingredients).toEqual([
      { name: "chicken", quantity: 150, unit: "g", category: "meat" },
      { name: "rice", quantity: 75, unit: "g", category: "pantry" },
    ]);
    expect(dinner.steps).toEqual(["Cook rice", "Cook chicken"]);
    expect(dinner.sourceUrl).toBe("https://example.com/recipe");
    expect(dinner.leftoverOf).toBeNull();

    const lunch = plan!.meals.find((m) => m.slot === "lunch")!;
    expect(lunch.leftoverOf).toEqual({ day: 0, slot: "dinner" });

    db.close();
  });

  it("orders all five slots breakfast<morning_snack<lunch<afternoon_snack<dinner", () => {
    const db = openDb(":memory:");
    const mk = (slot: Meal["slot"]): Meal => ({
      day: 0,
      slot,
      title: slot,
      cuisine: "western",
      proteinClass: "lean",
      base: "none",
      difficulty: "easy",
      ingredients: [{ name: "x", quantity: 1, unit: "g", category: "pantry" }],
      steps: ["do it"],
      leftoverOf: null,
    });
    // insert out of display order to prove sorting
    const id = savePlan(
      db,
      samplePlan({
        meals: [
          mk("dinner"),
          mk("breakfast"),
          mk("afternoon_snack"),
          mk("morning_snack"),
          mk("lunch"),
        ],
      }),
    );
    const order = getPlan(db, id)!.meals.map((m) => m.slot);
    expect(order).toEqual([
      "breakfast",
      "morning_snack",
      "lunch",
      "afternoon_snack",
      "dinner",
    ]);
    db.close();
  });

  it("round-trips a meal's servings", () => {
    const db = openDb(":memory:");
    const dinner: Meal = {
      day: 0,
      slot: "dinner",
      title: "Chicken Rice",
      cuisine: "asian",
      proteinClass: "lean",
      base: "rice",
      difficulty: "easy",
      servings: 3,
      ingredients: [{ name: "chicken", quantity: 450, unit: "g", category: "meat" }],
      steps: ["Cook"],
      leftoverOf: null,
    };
    const id = savePlan(db, samplePlan({ meals: [dinner] }));
    const back = getPlan(db, id)!.meals[0];
    expect(back.servings).toBe(3);
    db.close();
  });

  it("round-trips a meal's prep and cook minutes (and maps NULL to undefined)", () => {
    const db = openDb(":memory:");
    const withTimes: Meal = {
      day: 0,
      slot: "dinner",
      title: "Timed Meal",
      cuisine: "western",
      proteinClass: "lean",
      base: "rice",
      difficulty: "easy",
      prepMinutes: 12,
      cookMinutes: 18,
      ingredients: [{ name: "rice", quantity: 60, unit: "g", category: "pantry" }],
      steps: ["Cook"],
      leftoverOf: null,
    };
    const noTimes: Meal = {
      day: 1,
      slot: "breakfast",
      title: "Untimed Meal",
      cuisine: "western",
      proteinClass: "vegetarian",
      base: "none",
      difficulty: "easy",
      ingredients: [{ name: "oats", quantity: 60, unit: "g", category: "pantry" }],
      steps: ["Boil"],
      leftoverOf: null,
    };
    const id = savePlan(db, samplePlan({ meals: [withTimes, noTimes] }));
    const meals = getPlan(db, id)!.meals;
    const timed = meals.find((m) => m.title === "Timed Meal")!;
    expect(timed.prepMinutes).toBe(12);
    expect(timed.cookMinutes).toBe(18);
    const untimed = meals.find((m) => m.title === "Untimed Meal")!;
    expect(untimed.prepMinutes).toBeUndefined();
    expect(untimed.cookMinutes).toBeUndefined();
    db.close();
  });

  it("returns null for an unknown plan", () => {
    const db = openDb(":memory:");
    expect(getPlan(db, 999)).toBeNull();
    db.close();
  });

  it("lists plan summaries newest first without meals", () => {
    const db = openDb(":memory:");
    const id1 = savePlan(db, samplePlan({ weekStart: "2026-07-06", note: "a" }));
    const id2 = savePlan(db, samplePlan({ weekStart: "2026-07-13", note: "b" }));

    const summaries = listPlans(db);
    expect(summaries.length).toBe(2);
    expect(summaries[0].id).toBe(id2);
    expect(summaries[1].id).toBe(id1);
    expect(summaries[0].note).toBe("b");
    expect(summaries[0].status).toBe("draft");
    expect(summaries[0].createdAt).toBeTypeOf("string");
    expect(summaries[0]).not.toHaveProperty("meals");
    db.close();
  });

  it("rates a meal", () => {
    const db = openDb(":memory:");
    const id = savePlan(db, samplePlan());
    const plan = getPlan(db, id)!;
    const mealId = plan.meals.find((m) => m.slot === "dinner")!.id!;

    expect(rateMeal(db, mealId, 4)).toBe(1);
    const updated = getPlan(db, id)!;
    expect(updated.meals.find((m) => m.id === mealId)!.rating).toBe(4);
    // rating a nonexistent meal changes no rows
    expect(rateMeal(db, 999999, 3)).toBe(0);
    db.close();
  });

  it("updates a meal's content in place and resets its rating", () => {
    const db = openDb(":memory:");
    const id = savePlan(db, samplePlan());
    const plan = getPlan(db, id)!;
    const target = plan.meals.find((m) => m.slot === "dinner")!;
    const mealId = target.id!;

    // give it a rating first, to prove update resets it
    rateMeal(db, mealId, 5);

    const replacement: Meal = {
      day: 99, // ignored: day/slot/plan_id are preserved
      slot: "breakfast",
      title: "Turkey Stir Fry",
      cuisine: "thai",
      proteinClass: "lean",
      base: "noodles",
      difficulty: "medium",
      ingredients: [
        { name: "turkey", quantity: 200, unit: "g", category: "meat" },
        { name: "noodles", quantity: 120, unit: "g", category: "pantry" },
      ],
      steps: ["Fry turkey", "Add noodles"],
      sourceUrl: "https://example.com/turkey",
      leftoverOf: null,
      rating: 3, // ignored: update always resets rating to null
    };
    updateMeal(db, mealId, replacement);

    const updated = getPlan(db, id)!;
    const back = updated.meals.find((m) => m.id === mealId)!;
    // content overwritten
    expect(back.title).toBe("Turkey Stir Fry");
    expect(back.cuisine).toBe("thai");
    expect(back.proteinClass).toBe("lean");
    expect(back.base).toBe("noodles");
    expect(back.difficulty).toBe("medium");
    expect(back.ingredients).toEqual(replacement.ingredients);
    expect(back.steps).toEqual(["Fry turkey", "Add noodles"]);
    expect(back.sourceUrl).toBe("https://example.com/turkey");
    // rating reset
    expect(back.rating).toBeNull();
    // plan slot/day preserved (still the day-0 dinner)
    expect(back.day).toBe(0);
    expect(back.slot).toBe("dinner");
    db.close();
  });

  it("round-trips shopping items with boolean checked", () => {
    const db = openDb(":memory:");
    const planId = savePlan(db, samplePlan());
    const items: ShoppingItem[] = [
      {
        name: "chicken",
        totalQuantity: 300,
        unit: "g",
        category: "meat",
        checked: false,
      },
      {
        name: "rice",
        totalQuantity: 150,
        unit: "g",
        category: "pantry",
        checked: true,
      },
    ];
    saveShoppingItems(db, planId, items);

    const back = getShoppingItems(db, planId);
    expect(back.length).toBe(2);
    const chicken = back.find((i) => i.name === "chicken")!;
    expect(chicken.checked).toBe(false);
    expect(chicken.totalQuantity).toBe(300);
    const rice = back.find((i) => i.name === "rice")!;
    expect(rice.checked).toBe(true);
    db.close();
  });

  it("replaces shopping items on subsequent save", () => {
    const db = openDb(":memory:");
    const planId = savePlan(db, samplePlan());
    saveShoppingItems(db, planId, [
      { name: "a", totalQuantity: 1, unit: "g", category: "x", checked: false },
    ]);
    saveShoppingItems(db, planId, [
      { name: "b", totalQuantity: 2, unit: "g", category: "y", checked: true },
    ]);
    const back = getShoppingItems(db, planId);
    expect(back.map((i) => i.name)).toEqual(["b"]);
    db.close();
  });
});
