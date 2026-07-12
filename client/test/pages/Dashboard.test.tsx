import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { MealSchedule, PlanBundle, PlanSummary, Settings } from "../../src/types";
import { SLOT_ORDER } from "../../src/lib/meal";
import { Dashboard } from "../../src/pages/Dashboard";

vi.mock("../../src/api/client");
import * as api from "../../src/api/client";

function allOnSchedule(): MealSchedule {
  return Object.fromEntries(
    SLOT_ORDER.map((slot) => [slot, Array(7).fill(true)]),
  ) as MealSchedule;
}

const settings: Settings = {
  members: [],
  restrictions: [],
  avoidIngredients: [],
  proteinCadence: { veg_per_week: 2, red_or_high_fat_per_week: 2 },
  effort: "medium",
  defaultVegQuantities: {},
  mealSchedule: allOnSchedule(),
};

const summary: PlanSummary = {
  id: 5,
  weekStart: "2026-07-13",
  note: "quick meals",
  status: "active",
  createdAt: "2026-07-12T10:00:00Z",
};

const bundle: PlanBundle = {
  plan: {
    id: 5,
    weekStart: "2026-07-13",
    onHand: ["leek", "squash"],
    note: "quick meals",
    status: "active",
    meals: [
      {
        id: 1,
        day: 0,
        slot: "dinner",
        title: "Leek and potato soup",
        cuisine: "British",
        proteinClass: "vegetarian",
        base: "soup",
        difficulty: "easy",
        ingredients: [],
        steps: [],
        leftoverOf: null,
        rating: null,
      },
    ],
  },
  shopping: [
    { name: "Leek", totalQuantity: 2, unit: "pcs", category: "produce", checked: false },
  ],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("Dashboard", () => {
  test("shows the empty-state invite when there are no plans", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settings);
    vi.mocked(api.listPlans).mockResolvedValue([]);

    render(<Dashboard selectedPlanId={null} onSelectPlan={vi.fn()} />);

    expect(
      await screen.findByRole("button", { name: /plan your first week/i }),
    ).toBeInTheDocument();
  });

  test("renders the week board and shopping list when a plan exists", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settings);
    vi.mocked(api.listPlans).mockResolvedValue([summary]);
    vi.mocked(api.getPlan).mockResolvedValue(bundle);

    render(<Dashboard selectedPlanId={null} onSelectPlan={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/week board/i)).toBeInTheDocument(),
    );
    expect(screen.getByText("Leek and potato soup")).toBeInTheDocument();
    expect(screen.getByLabelText(/shopping list/i)).toBeInTheDocument();
    // The removed coverage strip should not appear.
    expect(screen.queryByLabelText(/veg box coverage/i)).not.toBeInTheDocument();
  });
});
