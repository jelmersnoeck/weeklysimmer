import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { ShoppingItem } from "../../src/types";
import { VegCoverageStrip } from "../../src/components/VegCoverageStrip";
import { ShoppingList } from "../../src/components/ShoppingList";

describe("VegCoverageStrip", () => {
  test("marks unused veg with the warning treatment and label", () => {
    render(
      <VegCoverageStrip
        vegBox={["leek", "kale", "squash"]}
        unusedVeg={["squash"]}
      />,
    );

    const unused = screen.getByRole("listitem", { name: /squash/i });
    expect(unused.className).toMatch(/is-unused/);
    expect(within(unused).getByText(/not used yet/i)).toBeInTheDocument();

    const used = screen.getByRole("listitem", { name: /leek/i });
    expect(used.className).not.toMatch(/is-unused/);
  });
});

describe("ShoppingList", () => {
  const items: ShoppingItem[] = [
    { name: "Leek", totalQuantity: 2, unit: "pcs", category: "Produce", checked: false },
    { name: "Potato", totalQuantity: 400, unit: "g", category: "Produce", checked: false },
    { name: "Milk", totalQuantity: 1, unit: "l", category: "Dairy", checked: false },
  ];

  test("groups items into category sections", () => {
    render(<ShoppingList items={items} />);

    const produce = screen.getByRole("group", { name: /produce/i });
    expect(within(produce).getByText("Leek")).toBeInTheDocument();
    expect(within(produce).getByText("Potato")).toBeInTheDocument();

    const dairy = screen.getByRole("group", { name: /dairy/i });
    expect(within(dairy).getByText("Milk")).toBeInTheDocument();
    expect(within(dairy).queryByText("Leek")).not.toBeInTheDocument();
  });

  test("toggling an item checks it off", async () => {
    const user = userEvent.setup();
    render(<ShoppingList items={items} />);

    const leek = screen.getByRole("checkbox", { name: /leek/i });
    expect(leek).not.toBeChecked();
    await user.click(leek);
    expect(leek).toBeChecked();
  });
});
