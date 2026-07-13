import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { ShoppingItem } from "../../src/types";
import { ShoppingList, buildShoppingText } from "../../src/components/ShoppingList";

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

  test("notes the foods you already have (excluded from the list)", () => {
    render(<ShoppingList items={items} onHand={["carrots", "rice"]} />);
    expect(
      screen.getByText(/you said you already have: carrots, rice/i),
    ).toBeInTheDocument();
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

describe("buildShoppingText", () => {
  const items: ShoppingItem[] = [
    { name: "Leek", totalQuantity: 2, unit: "pcs", category: "produce", checked: false },
    { name: "Potato", totalQuantity: 400, unit: "g", category: "produce", checked: false },
    { name: "Milk", totalQuantity: 1, unit: "l", category: "dairy", checked: false },
  ];

  test("is a flat list of unchecked items, one per line, no category headers", () => {
    const text = buildShoppingText(items, {}, ["metric"]);
    expect(text).toBe(["Leek (2 pcs)", "Potato (400 g)", "Milk (1 l)"].join("\n"));
  });

  test("omits checked-off items", () => {
    const text = buildShoppingText(items, { Potato: true, Milk: true }, ["metric"]);
    expect(text).toBe("Leek (2 pcs)");
  });

  test("returns empty string when everything is checked", () => {
    const text = buildShoppingText(
      items,
      { Leek: true, Potato: true, Milk: true },
      ["metric"],
    );
    expect(text).toBe("");
  });
});

describe("ShoppingList copy button", () => {
  const items: ShoppingItem[] = [
    { name: "Leek", totalQuantity: 2, unit: "pcs", category: "produce", checked: false },
    { name: "Milk", totalQuantity: 1, unit: "l", category: "dairy", checked: false },
  ];

  test("copies the unchecked items to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    render(<ShoppingList items={items} />);
    await user.click(screen.getByRole("checkbox", { name: /milk/i }));
    await user.click(screen.getByRole("button", { name: /copy list/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("Leek");
    expect(copied).not.toContain("Milk"); // checked off → excluded
    expect(await screen.findByText(/copied ✓/i)).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});

describe("ShoppingList persistence", () => {
  const items: ShoppingItem[] = [
    { name: "Leek", totalQuantity: 2, unit: "pcs", category: "produce", checked: false },
  ];

  test("remembers checked-off items across remounts via localStorage", async () => {
    const user = userEvent.setup();
    window.localStorage.clear();

    const first = render(<ShoppingList items={items} planId={42} />);
    await user.click(screen.getByRole("checkbox", { name: /leek/i }));
    expect(screen.getByRole("checkbox", { name: /leek/i })).toBeChecked();
    first.unmount();

    // A fresh mount for the same plan reads the remembered state.
    render(<ShoppingList items={items} planId={42} />);
    expect(screen.getByRole("checkbox", { name: /leek/i })).toBeChecked();
    window.localStorage.clear();
  });
});
