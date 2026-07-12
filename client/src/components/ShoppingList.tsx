import { useState } from "react";
import type { ShoppingItem } from "../types";
import "./ShoppingList.css";

interface ShoppingListProps {
  items: ShoppingItem[];
}

function groupByCategory(items: ShoppingItem[]): [string, ShoppingItem[]][] {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const category = item.category || "Other";
    const bucket = groups.get(category);
    if (bucket) bucket.push(item);
    else groups.set(category, [item]);
  }
  return Array.from(groups.entries());
}

export function ShoppingList({ items }: ShoppingListProps) {
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
            <legend className="shopping__aisle-name">{category}</legend>
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
                        {item.totalQuantity}
                        {item.unit ? ` ${item.unit}` : ""}
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
