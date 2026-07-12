import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import type { ShoppingItem } from "../../src/types";
import { ShoppingList } from "../../src/components/ShoppingList";

describe("ShoppingList", () => {
  const items: ShoppingItem[] = [
    { name: "Leek", totalQuantity: 2, unit: "pcs", category: "produce", checked: false },
    { name: "Potato", totalQuantity: 400, unit: "g", category: "produce", checked: false },
    { name: "Milk", totalQuantity: 1, unit: "l", category: "dairy", checked: false },
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

  test("renders a friendly 'Bulk staples' section for bulk_staples items", () => {
    render(
      <ShoppingList
        items={[
          {
            name: "Oats",
            totalQuantity: 500,
            unit: "g",
            category: "bulk_staples",
            checked: false,
          },
        ]}
      />,
    );

    const bulk = screen.getByRole("group", { name: /bulk staples/i });
    expect(within(bulk).getByText("Oats")).toBeInTheDocument();
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
