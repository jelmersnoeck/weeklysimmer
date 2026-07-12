import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Meal, WeeklyPlan } from "../../src/types";
import { MealCard } from "../../src/components/MealCard";
import { MealDetail } from "../../src/components/MealDetail";
import { WeekGrid } from "../../src/components/WeekGrid";
import * as api from "../../src/api/client";

function makeMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: 1,
    day: 0,
    slot: "dinner",
    title: "Leek and potato soup",
    cuisine: "British",
    proteinClass: "vegetarian",
    base: "soup",
    difficulty: "easy",
    ingredients: [
      { name: "Leek", quantity: 2, unit: "pcs", category: "Produce" },
      { name: "Potato", quantity: 400, unit: "g", category: "Produce" },
    ],
    steps: ["Chop the leeks", "Simmer until soft"],
    leftoverOf: null,
    rating: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MealCard", () => {
  test("renders the meal title", () => {
    render(<MealCard meal={makeMeal()} onSelect={vi.fn()} />);
    expect(screen.getByText("Leek and potato soup")).toBeInTheDocument();
  });

  test("shows a leftovers badge for leftover meals", () => {
    render(
      <MealCard
        meal={makeMeal({ leftoverOf: { day: 0, slot: "dinner" } })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/leftovers/i)).toBeInTheDocument();
  });

  test("shows the total time badge when prep and cook are set", () => {
    render(
      <MealCard
        meal={makeMeal({ prepMinutes: 10, cookMinutes: 15 })}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/25/)).toBeInTheDocument();
    expect(screen.getByText(/min/)).toBeInTheDocument();
  });

  test("shows no time badge when prep and cook are absent", () => {
    render(<MealCard meal={makeMeal()} onSelect={vi.fn()} />);
    expect(screen.queryByText(/min/)).not.toBeInTheDocument();
  });
});

describe("WeekGrid", () => {
  test("renders all seven day headings", () => {
    const plan: WeeklyPlan = {
      id: 3,
      weekStart: "2026-07-13",
      vegBox: ["leek"],
      note: "",
      status: "active",
      meals: [makeMeal()],
    };
    render(<WeekGrid plan={plan} onSelectMeal={vi.fn()} />);
    for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }
  });

  test("renders all five slot labels per day, including both snacks", () => {
    const plan: WeeklyPlan = {
      id: 3,
      weekStart: "2026-07-13",
      vegBox: ["leek"],
      note: "",
      status: "active",
      meals: [
        makeMeal({ id: 1, day: 0, slot: "breakfast", title: "Porridge" }),
        makeMeal({ id: 2, day: 0, slot: "morning_snack", title: "Apple" }),
        makeMeal({ id: 3, day: 0, slot: "lunch", title: "Salad" }),
        makeMeal({ id: 4, day: 0, slot: "afternoon_snack", title: "Yoghurt" }),
        makeMeal({ id: 5, day: 0, slot: "dinner", title: "Soup" }),
      ],
    };
    render(<WeekGrid plan={plan} onSelectMeal={vi.fn()} />);
    // Each of the five slot labels appears once per day (7 days).
    for (const label of [
      "Breakfast",
      "Morning snack",
      "Lunch",
      "Afternoon snack",
      "Dinner",
    ]) {
      expect(screen.getAllByText(label)).toHaveLength(7);
    }
    // The snack meals for Monday render in their cells.
    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Yoghurt")).toBeInTheDocument();
  });
});

describe("MealDetail", () => {
  test("clicking a star calls rateMeal with the rating", async () => {
    const user = userEvent.setup();
    const rateSpy = vi.spyOn(api, "rateMeal").mockResolvedValue({ ok: true });
    render(
      <MealDetail
        meal={makeMeal()}
        planId={3}
        onClose={vi.fn()}
        onRated={vi.fn()}
        onRegenerated={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /rate 4 of 5/i }));
    expect(rateSpy).toHaveBeenCalledWith(1, 4);
  });

  test("shows the prep/cook/total time row when the fields are set", () => {
    render(
      <MealDetail
        meal={makeMeal({ prepMinutes: 10, cookMinutes: 15 })}
        planId={3}
        onClose={vi.fn()}
        onRated={vi.fn()}
        onRegenerated={vi.fn()}
      />,
    );
    expect(screen.getByText(/Prep/)).toBeInTheDocument();
    expect(screen.getByText(/Cook/)).toBeInTheDocument();
    expect(screen.getByText(/Total/)).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  test("clicking regenerate calls regenerateMeal", async () => {
    const user = userEvent.setup();
    const regenSpy = vi
      .spyOn(api, "regenerateMeal")
      .mockResolvedValue({ plan: {} as WeeklyPlan, shopping: [], unusedVeg: [] });
    render(
      <MealDetail
        meal={makeMeal()}
        planId={3}
        onClose={vi.fn()}
        onRated={vi.fn()}
        onRegenerated={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /regenerate/i }));
    expect(regenSpy).toHaveBeenCalledWith(3, 1);
  });
});
