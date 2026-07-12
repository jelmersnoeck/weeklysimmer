import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { MealSchedule, Options, Settings } from "../src/types";
import { SLOT_ORDER } from "../src/lib/meal";
import App from "../src/App";

vi.mock("../src/api/client");
import * as api from "../src/api/client";

function allOnSchedule(): MealSchedule {
  return Object.fromEntries(
    SLOT_ORDER.map((slot) => [slot, Array(7).fill(true)]),
  ) as MealSchedule;
}

function makeSettings(configured: boolean): Settings {
  return {
    configured,
    household: [{ id: "a1", type: "adult", appetite: "standard" }],
    proteins: [],
    vegetablesLiked: [],
    fruitsLiked: [],
    cuisinesLiked: [],
    dishTypesLiked: [],
    flavoursLiked: [],
    avoid: [],
    diet: "none",
    effort: "medium",
    mealSchedule: allOnSchedule(),
  };
}

const options: Options = {
  proteins: ["chicken", "tofu"],
  cuisines: ["italian"],
  dishTypes: ["pasta"],
  flavours: ["cheesy"],
  avoids: ["dairy"],
  diets: ["none", "vegan"],
  vegetables: ["carrot"],
  fruits: ["apple"],
  frequencies: ["never", "occasionally", "weekly", "often"],
  appetites: ["light", "standard", "hearty", "very_active"],
  memberTypes: ["adult", "child"],
  appetiteFactor: {
    adult: { light: 0.9, standard: 1, hearty: 1.2, very_active: 1.4 },
    child: { light: 0.4, standard: 0.5, hearty: 0.7, very_active: 0.9 },
  },
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  test("shows onboarding and blocks the dashboard when unconfigured", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(makeSettings(false));
    vi.mocked(api.getOptions).mockResolvedValue(options);
    vi.mocked(api.listPlans).mockResolvedValue([]);
    vi.mocked(api.listJobs).mockResolvedValue([]);

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: /let's set up your food preferences/i,
      }),
    ).toBeInTheDocument();
    // No nav, and the Dashboard's empty-state invite must not appear.
    expect(
      screen.queryByRole("button", { name: /plan your first week/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^dashboard$/i }),
    ).not.toBeInTheDocument();
  });

  test("shows the dashboard and a Settings nav entry when configured", async () => {
    vi.mocked(api.getSettings).mockResolvedValue(makeSettings(true));
    vi.mocked(api.getOptions).mockResolvedValue(options);
    vi.mocked(api.listPlans).mockResolvedValue([]);
    vi.mocked(api.listJobs).mockResolvedValue([]);

    render(<App />);

    expect(
      await screen.findByRole("button", { name: /plan your first week/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^settings$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: /let's set up your food preferences/i,
      }),
    ).not.toBeInTheDocument();
  });

  test("opens the Settings screen from the nav", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getSettings).mockResolvedValue(makeSettings(true));
    vi.mocked(api.getOptions).mockResolvedValue(options);
    vi.mocked(api.listPlans).mockResolvedValue([]);
    vi.mocked(api.listJobs).mockResolvedValue([]);

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /^settings$/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: /^preferences$/i }),
      ).toBeInTheDocument(),
    );
  });
});
