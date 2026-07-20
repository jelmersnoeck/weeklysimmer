import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  Job,
  MealSchedule,
  PlanBundle,
  PlanSummary,
  Settings,
} from "../../src/types";
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

const runningJob: Job = {
  id: "job-1",
  status: "running",
  planId: null,
  error: null,
  weekStart: "2026-07-13",
  createdAt: "2026-07-12T10:00:00Z",
};

const doneJob: Job = { ...runningJob, status: "done", planId: 5 };

afterEach(() => {
  vi.clearAllMocks();
});

describe("Dashboard", () => {
  test("shows the empty-state invite when there are no plans", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settings);
    vi.mocked(api.listPlans).mockResolvedValue([]);
    vi.mocked(api.listJobs).mockResolvedValue([]);

    render(<Dashboard selectedPlanId={null} onSelectPlan={vi.fn()} />);

    expect(
      await screen.findByRole("button", { name: /plan your first week/i }),
    ).toBeInTheDocument();
  });

  test("renders the week board and shopping list when a plan exists", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settings);
    vi.mocked(api.listPlans).mockResolvedValue([summary]);
    vi.mocked(api.listJobs).mockResolvedValue([]);
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

  test("submitting a new week kicks off a job and shows the generating panel", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getSettings).mockResolvedValue(settings);
    vi.mocked(api.listPlans).mockResolvedValue([]);
    vi.mocked(api.listJobs).mockResolvedValue([]);
    vi.mocked(api.generatePlan).mockResolvedValue({ jobId: "job-1" });
    // Job stays running for this test, so the panel persists.
    vi.mocked(api.getJob).mockResolvedValue(runningJob);

    render(<Dashboard selectedPlanId={null} onSelectPlan={vi.fn()} />);

    await user.click(
      await screen.findByRole("button", { name: /plan your first week/i }),
    );
    await user.click(screen.getByRole("button", { name: /generate/i }));

    expect(
      await screen.findByText(/runs in the background/i),
    ).toBeInTheDocument();
    expect(api.generatePlan).toHaveBeenCalledTimes(1);
  });

  test("a job that finishes loads and selects the plan", async () => {
    const user = userEvent.setup();
    const onSelectPlan = vi.fn();
    vi.mocked(api.getSettings).mockResolvedValue(settings);
    vi.mocked(api.listPlans).mockResolvedValue([]);
    vi.mocked(api.listJobs).mockResolvedValue([]);
    vi.mocked(api.generatePlan).mockResolvedValue({ jobId: "job-1" });
    // First poll already reports "done" — deterministic, no timers needed.
    vi.mocked(api.getJob).mockResolvedValue(doneJob);
    vi.mocked(api.getPlan).mockResolvedValue(bundle);

    render(<Dashboard selectedPlanId={null} onSelectPlan={onSelectPlan} />);

    await user.click(
      await screen.findByRole("button", { name: /plan your first week/i }),
    );
    await user.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/week board/i)).toBeInTheDocument(),
    );
    expect(screen.getByText("Leek and potato soup")).toBeInTheDocument();
    expect(api.getPlan).toHaveBeenCalledWith(5);
    expect(onSelectPlan).toHaveBeenCalledWith(5);
  });

  test("resumes the generating panel on mount when a job is still running", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(settings);
    vi.mocked(api.listPlans).mockResolvedValue([]);
    vi.mocked(api.listJobs).mockResolvedValue([runningJob]);
    vi.mocked(api.getJob).mockResolvedValue(runningJob);

    render(<Dashboard selectedPlanId={null} onSelectPlan={vi.fn()} />);

    expect(
      await screen.findByText(/runs in the background/i),
    ).toBeInTheDocument();
  });
});
