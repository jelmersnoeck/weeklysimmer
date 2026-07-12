import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { NewWeekForm } from "../../src/components/NewWeekForm";

describe("NewWeekForm", () => {
  test("adding and removing veg chips updates the visible chips", async () => {
    const user = userEvent.setup();
    render(<NewWeekForm onGenerate={vi.fn()} recentTitles={[]} />);

    const vegInput = screen.getByLabelText(/add a vegetable/i);
    await user.type(vegInput, "leek{enter}");
    await user.type(vegInput, "kale{enter}");

    expect(screen.getByText("leek")).toBeInTheDocument();
    expect(screen.getByText("kale")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /remove leek/i }));
    expect(screen.queryByText("leek")).not.toBeInTheDocument();
    expect(screen.getByText("kale")).toBeInTheDocument();
  });

  test("submit calls onGenerate with weekStart, vegBox, note and avoid", async () => {
    const user = userEvent.setup();
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(
      <NewWeekForm
        onGenerate={onGenerate}
        recentTitles={["Leek soup", "Kale salad"]}
      />,
    );

    await user.clear(screen.getByLabelText(/week start/i));
    await user.type(screen.getByLabelText(/week start/i), "2026-07-13");

    const vegInput = screen.getByLabelText(/add a vegetable/i);
    await user.type(vegInput, "leek{enter}");

    await user.type(screen.getByLabelText(/note/i), "quick meals");

    // Avoid-repeating multiselect is populated from recent titles.
    await user.selectOptions(screen.getByLabelText(/avoid repeating/i), "Leek soup");

    await user.click(screen.getByRole("button", { name: /generate/i }));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerate).toHaveBeenCalledWith({
      weekStart: "2026-07-13",
      vegBox: ["leek"],
      note: "quick meals",
      avoid: ["Leek soup"],
    });
  });
});
