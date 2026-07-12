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

export function ShoppingList({ items, units = ["metric"] }: ShoppingListProps) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.name, i.checked])),
  );

  function toggle(name: string) {
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }));
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
      <h2 className="shopping__title">Shopping list</h2>
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
                        {formatQuantity(
                          {
                            quantity: item.totalQuantity,
                            unit: item.unit,
                            cupQuantity: item.cupQuantity,
                            cupUnit: item.cupUnit,
                          },
                          units,
                        )}
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
