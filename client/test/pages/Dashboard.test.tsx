import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { PlanBundle, PlanSummary } from "../../src/types";
import { Dashboard } from "../../src/pages/Dashboard";

vi.mock("../../src/api/client");
import * as api from "../../src/api/client";

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
    vegBox: ["leek", "squash"],
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
    { name: "Leek", totalQuantity: 2, unit: "pcs", category: "Produce", checked: false },
  ],
  unusedVeg: ["squash"],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("Dashboard", () => {
  test("shows the empty-state invite when there are no plans", async () => {
    vi.mocked(api.listPlans).mockResolvedValue([]);

    render(<Dashboard selectedPlanId={null} onSelectPlan={vi.fn()} />);

    expect(
      await screen.findByRole("button", { name: /plan your first week/i }),
    ).toBeInTheDocument();
  });

  test("renders the coverage strip and week board when a plan exists", async () => {
    vi.mocked(api.listPlans).mockResolvedValue([summary]);
    vi.mocked(api.getPlan).mockResolvedValue(bundle);

    render(<Dashboard selectedPlanId={null} onSelectPlan={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByLabelText(/veg box coverage/i)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/week board/i)).toBeInTheDocument();
    expect(screen.getByText("Leek and potato soup")).toBeInTheDocument();
    // Unused veg flare shows on the coverage strip.
    expect(screen.getByText(/not used yet/i)).toBeInTheDocument();
  });
});
