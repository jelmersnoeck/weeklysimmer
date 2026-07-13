import { useState } from "react";
import type { MeasurementSystem, ShoppingItem } from "../types";
import { formatQuantity } from "../lib/quantity";
import "./ShoppingList.css";

interface ShoppingListProps {
  items: ShoppingItem[];
  units?: MeasurementSystem[];
}

// Friendly, human-readable names for known shopping categories.
const CATEGORY_LABELS: Record<string, string> = {
  produce: "Produce",
  meat: "Meat",
  dairy: "Dairy",
  fish: "Fish",
  bulk_staples: "Bulk staples",
  pantry: "Pantry",
  grains: "Grains",
};

// Title Case fallback for unknown categories: "baking_goods" → "Baking Goods".
function prettyCategory(category: string): string {
  const key = category.toLowerCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return category
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function groupByCategory(items: ShoppingItem[]): [string, ShoppingItem[]][] {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const category = item.category || "Other";
    const bucket = groups.get(category);
    if (bucket) bucket.push(item);
    else groups.set(category, [item]);
  }
  // Keep existing (insertion) order, but push Bulk staples to its own section last.
  return Array.from(groups.entries()).sort(([a], [b]) => {
    const aBulk = a.toLowerCase() === "bulk_staples";
    const bBulk = b.toLowerCase() === "bulk_staples";
    return aBulk === bBulk ? 0 : aBulk ? 1 : -1;
  });
}

function itemQty(item: ShoppingItem, units: MeasurementSystem[]): string {
  return formatQuantity(
    {
      quantity: item.totalQuantity,
      unit: item.unit,
      cupQuantity: item.cupQuantity,
      cupUnit: item.cupUnit,
    },
    units,
  );
}

/**
 * Plain-text shopping list for pasting into another app — grouped by aisle, one
 * item per line as "- name (qty)". Only the items NOT checked off are included
 * (a checked item is one you already have / don't need to buy). Returns "" when
 * nothing remains.
 */
export function buildShoppingText(
  items: ShoppingItem[],
  checked: Record<string, boolean>,
  units: MeasurementSystem[],
): string {
  const remaining = items.filter((i) => !checked[i.name]);
  if (remaining.length === 0) return "";
  return groupByCategory(remaining)
    .map(([category, group]) =>
      [
        prettyCategory(category),
        ...group.map((i) => `- ${i.name} (${itemQty(i, units)})`),
      ].join("\n"),
    )
    .join("\n\n");
}

export function ShoppingList({ items, units = ["metric"] }: ShoppingListProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.name, i.checked])),
  );
  const [copyState, setCopyState] = useState<"idle" | "copied" | "empty">("idle");
  const [fallbackText, setFallbackText] = useState<string | null>(null);

  function toggle(name: string) {
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }));
    setCopyState("idle");
    setFallbackText(null);
  }

  async function handleCopy() {
    const text = buildShoppingText(items, checked, units);
    if (!text) {
      setCopyState("empty");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setFallbackText(null);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — show the text to copy by hand.
      setFallbackText(text);
      setCopyState("idle");
    }
  }

  if (items.length === 0) {
    return (
      <section className="shopping" aria-label="Shopping list">
        <h2 className="shopping__title">Shopping list</h2>
        <p className="shopping__empty">
          Nothing to buy yet — generate a plan to build your list.
        </p>
      </section>
    );
  }

  const groups = groupByCategory(items);

  return (
    <section className="shopping" aria-label="Shopping list">
      <div className="shopping__head">
        <h2 className="shopping__title">Shopping list</h2>
        <div className="shopping__actions">
          <button
            type="button"
            className="btn btn--ghost btn--small"
            onClick={handleCopy}
          >
            {copyState === "copied" ? "Copied ✓" : "Copy list"}
          </button>
          <span className="shopping__copy-status" role="status" aria-live="polite">
            {copyState === "copied" && "Copied unchecked items to your clipboard."}
            {copyState === "empty" && "Everything's checked off — nothing to copy."}
          </span>
        </div>
      </div>
      <p className="shopping__hint">
        Check off what you already have — the copy leaves those out.
      </p>

      {fallbackText !== null && (
        <div className="shopping__fallback">
          <label htmlFor="shopping-copytext" className="shopping__fallback-label">
            Copy this list:
          </label>
          <textarea
            id="shopping-copytext"
            className="shopping__fallback-text mono"
            readOnly
            rows={Math.min(14, fallbackText.split("\n").length + 1)}
            value={fallbackText}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      )}

      <div className="shopping__aisles">
        {groups.map(([category, group]) => (
          <fieldset key={category} className="shopping__aisle">
            <legend className="shopping__aisle-name">
              {prettyCategory(category)}
            </legend>
            <ul className="shopping__items">
              {group.map((item) => {
                const id = `shop-${category}-${item.name}`.replace(/\s+/g, "-");
                const isChecked = Boolean(checked[item.name]);
                return (
                  <li
                    key={item.name}
                    className={`shopping__item${isChecked ? " is-checked" : ""}`}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(item.name)}
                    />
                    <label htmlFor={id} className="shopping__item-label">
                      <span className="shopping__item-name">{item.name}</span>
                      <span className="mono shopping__item-qty">
                        {itemQty(item, units)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </section>
  );
}
