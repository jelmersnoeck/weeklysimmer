import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { MealSchedule } from "../../src/types";
import { SLOT_ORDER } from "../../src/lib/meal";
import { NewWeekForm } from "../../src/components/NewWeekForm";

function allOnSchedule(): MealSchedule {
  return Object.fromEntries(
    SLOT_ORDER.map((slot) => [slot, Array(7).fill(true)]),
  ) as MealSchedule;
}

describe("NewWeekForm", () => {
  test("adding and removing on-hand chips updates the visible chips", async () => {
    const user = userEvent.setup();
    render(
      <NewWeekForm
        onGenerate={vi.fn()}
        recentTitles={[]}
        defaultSchedule={allOnSchedule()}
      />,
    );

    const input = screen.getByLabelText(/what foods do you have to use up/i);
    await user.type(input, "leek{enter}");
    await user.type(input, "kale{enter}");

    expect(screen.getByText("leek")).toBeInTheDocument();
    expect(screen.getByText("kale")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove leek/i }));
    expect(screen.queryByText("leek")).not.toBeInTheDocument();
    expect(screen.getByText("kale")).toBeInTheDocument();
  });

  test("submit sends weekStart, onHand, note, avoid and enabledSlots", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(
      <NewWeekForm
        onGenerate={onGenerate}
        recentTitles={["Leek soup", "Kale salad"]}
        defaultSchedule={allOnSchedule()}
        today={new Date(2026, 6, 12)}
      />,
    );

    // Coming Monday (13 Jul, since 12 Jul 2026 is a Sunday) is the default.
    await user.selectOptions(screen.getByLabelText(/^week$/i), "2026-07-13");

    await user.type(
      screen.getByLabelText(/what foods do you have to use up/i),
      "leek{enter}",
    );
    await user.type(screen.getByLabelText(/note/i), "quick meals");
    await user.selectOptions(screen.getByLabelText(/avoid repeating/i), "Leek soup");

    // Disable an entire slot via its row header: no breakfast entries remain.
    await user.click(
      screen.getByRole("rowheader", { name: /toggle all breakfast meals/i }),
    );

    await user.click(screen.getByRole("button", { name: /generate/i }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    const arg = onGenerate.mock.calls[0][0];
    expect(arg.weekStart).toBe("2026-07-13");
    expect(arg.onHand).toEqual(["leek"]);
    expect(arg.note).toBe("quick meals");
    expect(arg.avoid).toEqual(["Leek soup"]);
    // Started all-on (35 cells); one slot (7 cells) turned off leaves 28.
    expect(arg.enabledSlots).toHaveLength(28);
    expect(arg.enabledSlots.every((s: { slot: string }) => s.slot !== "breakfast"))
      .toBe(true);
  });

  test("toggling a single cell flips its pressed state", async () => {
    const user = userEvent.setup();
    render(
      <NewWeekForm
        onGenerate={vi.fn()}
        recentTitles={[]}
        defaultSchedule={allOnSchedule()}
      />,
    );

    const cell = screen.getByRole("gridcell", { name: /monday breakfast/i });
    expect(cell).toHaveAttribute("aria-pressed", "true");
    await user.click(cell);
    expect(cell).toHaveAttribute("aria-pressed", "false");
  });

  test("blocks submit when no meals are selected", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn();
    render(
      <NewWeekForm
        onGenerate={onGenerate}
        recentTitles={[]}
        defaultSchedule={allOnSchedule()}
      />,
    );

    // Turn every day column off, clearing the whole grid.
    for (const day of [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]) {
      await user.click(
        screen.getByRole("columnheader", {
          name: new RegExp(`toggle all meals on ${day}`, "i"),
        }),
      );
    }

    await user.click(screen.getByRole("button", { name: /generate/i }));

    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.getByText(/pick at least one meal to plan/i)).toBeInTheDocument();
  });
});
