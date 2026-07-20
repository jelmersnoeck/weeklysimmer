import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { Options, Settings } from "../../src/types";
import { SLOT_ORDER } from "../../src/lib/meal";
import { Settings as SettingsScreen } from "../../src/pages/Settings";

vi.mock("../../src/api/client");
import * as api from "../../src/api/client";

const options: Options = {
  proteins: ["chicken", "tofu"],
  cuisines: ["italian"],
  dishTypes: ["pasta", "salad"],
  flavours: ["cheesy", "herby"],
  avoids: ["dairy", "lactose"],
  diets: ["vegetarian", "vegan"],
  measurementSystems: ["metric", "cups"],
  vegetables: ["carrot", "broccoli"],
  fruits: ["apple"],
  frequencies: ["never", "occasionally", "weekly", "often"],
  appetites: ["light", "standard", "hearty", "very_active"],
  memberTypes: ["adult", "child"],
  appetiteFactor: {
    adult: { light: 0.9, standard: 1, hearty: 1.2, very_active: 1.4 },
    child: { light: 0.4, standard: 0.5, hearty: 0.7, very_active: 0.9 },
    toddler: { light: 0.25, standard: 0.35, hearty: 0.5, very_active: 0.6 },
    baby: { light: 0.1, standard: 0.15, hearty: 0.2, very_active: 0.25 },
  },
};

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    configured: true,
    household: [{ id: "a1", type: "adult", appetite: "standard" }],
    proteins: [{ key: "chicken", frequency: "never" }],
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
    mealSchedule: Object.fromEntries(
      SLOT_ORDER.map((s) => [s, Array(7).fill(true)]),
    ) as Settings["mealSchedule"],
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("Settings screen", () => {
  test("renders sections built from the options", () => {
    render(
      <SettingsScreen
        initial={makeSettings()}
        options={options}
        mode="edit"
        onSaved={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /household/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /proteins/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /vegetables you like/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^diet$/i })).toBeInTheDocument();
    // Chips come from the option lists (labelized).
    expect(
      screen.getByRole("button", { name: /^carrot$/i }),
    ).toBeInTheDocument();
  });

  test("toggling a liked chip flips its pressed state", async () => {
    const user = userEvent.setup();
    render(
      <SettingsScreen
        initial={makeSettings()}
        options={options}
        mode="edit"
        onSaved={vi.fn()}
      />,
    );

    const chip = screen.getByRole("button", { name: /^broccoli$/i });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await user.click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  test("shows a conflict warning when a meat is selected under vegan", async () => {
    const user = userEvent.setup();
    render(
      <SettingsScreen
        initial={makeSettings({ diets: ["vegan"] })}
        options={options}
        mode="edit"
        onSaved={vi.fn()}
      />,
    );

    // No conflict yet — chicken is "never".
    expect(screen.queryByText(/isn't vegan/i)).not.toBeInTheDocument();

    const chickenSelect = screen.getByLabelText(/chicken frequency/i);
    await user.selectOptions(chickenSelect, "weekly");

    expect(await screen.findAllByText(/chicken isn't vegan/i)).not.toHaveLength(
      0,
    );
  });

  test("saving PUTs the draft and fires onSaved with the returned settings", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const initial = makeSettings();
    const returned = makeSettings({ vegetablesLiked: ["carrot"] });
    vi.mocked(api.updateSettings).mockResolvedValue({
      settings: returned,
      conflicts: [],
    });

    render(
      <SettingsScreen
        initial={initial}
        options={options}
        mode="onboarding"
        onSaved={onSaved}
      />,
    );

    // Make an edit so the draft differs.
    await user.click(screen.getByRole("button", { name: /^carrot$/i }));
    await user.click(screen.getByRole("button", { name: /save & continue/i }));

    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledTimes(1));
    const draftSent = vi.mocked(api.updateSettings).mock.calls[0][0];
    expect(draftSent.vegetablesLiked).toContain("carrot");
    // mealSchedule carried through unchanged.
    expect(draftSent.mealSchedule).toEqual(initial.mealSchedule);
    expect(onSaved).toHaveBeenCalledWith(returned);
  });

  test("renders the Units section and the lactose avoid chip", () => {
    render(
      <SettingsScreen
        initial={makeSettings()}
        options={options}
        mode="edit"
        onSaved={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: /^units$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^metric$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^cups$/i })).toBeInTheDocument();
    // lactose comes straight from options.avoids.
    expect(screen.getByRole("button", { name: /^lactose$/i })).toBeInTheDocument();
  });

  test("diet is multi-select — toggling adds and removes membership", async () => {
    const user = userEvent.setup();
    render(
      <SettingsScreen
        initial={makeSettings()}
        options={options}
        mode="edit"
        onSaved={vi.fn()}
      />,
    );

    const veg = screen.getByRole("button", { name: /^vegetarian$/i });
    const vegan = screen.getByRole("button", { name: /^vegan$/i });
    expect(veg).toHaveAttribute("aria-pressed", "false");

    await user.click(veg);
    await user.click(vegan);
    expect(veg).toHaveAttribute("aria-pressed", "true");
    expect(vegan).toHaveAttribute("aria-pressed", "true");

    // Toggling off removes it again.
    await user.click(veg);
    expect(veg).toHaveAttribute("aria-pressed", "false");
    expect(vegan).toHaveAttribute("aria-pressed", "true");
  });

  test("units keeps at least one system selected", async () => {
    const user = userEvent.setup();
    render(
      <SettingsScreen
        initial={makeSettings({ units: ["metric"] })}
        options={options}
        mode="edit"
        onSaved={vi.fn()}
      />,
    );

    const metric = screen.getByRole("button", { name: /^metric$/i });
    expect(metric).toHaveAttribute("aria-pressed", "true");
    // Removing the last one is blocked.
    await user.click(metric);
    expect(metric).toHaveAttribute("aria-pressed", "true");
  });

  test("saving includes the selected diets and units", async () => {
    const user = userEvent.setup();
    const initial = makeSettings({ diets: [], units: ["metric"] });
    vi.mocked(api.updateSettings).mockResolvedValue({
      settings: initial,
      conflicts: [],
    });

    render(
      <SettingsScreen
        initial={initial}
        options={options}
        mode="edit"
        onSaved={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^vegetarian$/i }));
    await user.click(screen.getByRole("button", { name: /^cups$/i }));
    await user.click(screen.getByRole("button", { name: /save preferences/i }));

    await waitFor(() => expect(api.updateSettings).toHaveBeenCalledTimes(1));
    const draftSent = vi.mocked(api.updateSettings).mock.calls[0][0];
    expect(draftSent.diets).toContain("vegetarian");
    expect(draftSent.units).toEqual(["metric", "cups"]);
  });

  test("blocks removing the last household member", () => {
    render(
      <SettingsScreen
        initial={makeSettings()}
        options={options}
        mode="edit"
        onSaved={vi.fn()}
      />,
    );
    const members = screen.getByRole("heading", { name: /household/i })
      .parentElement as HTMLElement;
    const remove = within(members).getByRole("button", {
      name: /remove member/i,
    });
    expect(remove).toBeDisabled();
  });

  test("edits and saves the personalisation note", async () => {
    const user = userEvent.setup();
    vi.mocked(api.updateSettings).mockResolvedValue({
      settings: makeSettings({ personalNote: "no pork, one-pot only" }),
      conflicts: [],
    });
    render(
      <SettingsScreen
        initial={makeSettings()}
        options={options}
        mode="edit"
        onSaved={() => {}}
      />,
    );

    const box = screen.getByLabelText("Personalisation", { selector: "textarea" });
    await user.type(box, "no pork, one-pot only");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(api.updateSettings).toHaveBeenCalled());
    const sent = vi.mocked(api.updateSettings).mock.calls[0][0];
    expect(sent.personalNote).toBe("no pork, one-pot only");
  });
});
