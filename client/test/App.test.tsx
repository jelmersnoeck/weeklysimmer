import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { MealSchedule } from "../src/types";
import { SLOT_ORDER } from "../src/lib/meal";
import App from "../src/App";

vi.mock("../src/api/client");
import * as api from "../src/api/client";

afterEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  test("renders the app title and switches between views", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listPlans).mockResolvedValue([]);
    vi.mocked(api.listJobs).mockResolvedValue([]);
    vi.mocked(api.getSettings).mockResolvedValue({
      members: [],
      restrictions: [],
      avoidIngredients: [],
      proteinCadence: { veg_per_week: 2, red_or_high_fat_per_week: 2 },
      effort: "medium",
      defaultVegQuantities: {},
      mealSchedule: Object.fromEntries(
        SLOT_ORDER.map((slot) => [slot, Array(7).fill(true)]),
      ) as MealSchedule,
    });

    render(<App />);

    expect(
      screen.getByRole("heading", { name: /the prep sheet/i }),
    ).toBeInTheDocument();

    // Dashboard is the default view; its empty-state invite appears.
    expect(
      await screen.findByRole("button", { name: /plan your first week/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^history$/i }));
    expect(
      await screen.findByText(/no past weeks yet/i),
    ).toBeInTheDocument();
  });
});
