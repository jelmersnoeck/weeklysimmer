import type { MeasurementSystem, ShoppingDelta, ShoppingItem } from "../types";
import { formatQuantity } from "../lib/quantity";
import "./WhatChanged.css";

interface WhatChangedProps {
  delta: ShoppingDelta;
  units: MeasurementSystem[];
  onDismiss: () => void;
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

function List({
  items,
  units,
  empty,
}: {
  items: ShoppingItem[];
  units: MeasurementSystem[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="what-changed__empty">{empty}</p>;
  }
  return (
    <ul className="what-changed__list">
      {items.map((it) => (
        <li key={`${it.name}-${it.unit}`}>
          <span>{it.name}</span>
          <span className="what-changed__qty mono">{itemQty(it, units)}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The result panel shown after a mid-week adjustment: what to buy for the new meals,
 * and what you already bought that's now surplus.
 */
export function WhatChanged({ delta, units, onDismiss }: WhatChangedProps) {
  return (
    <section className="what-changed" aria-label="What changed">
      <div className="what-changed__head">
        <h3 className="what-changed__title">What changed</h3>
        <button type="button" className="btn btn--ghost btn--small" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
      <div className="what-changed__cols">
        <div>
          <h4 className="what-changed__subtitle">To buy</h4>
          <List items={delta.toBuy} units={units} empty="Nothing new to buy." />
        </div>
        <div>
          <h4 className="what-changed__subtitle">Leftover / no longer needed</h4>
          <List
            items={delta.leftover}
            units={units}
            empty="Nothing freed up."
          />
        </div>
      </div>
    </section>
  );
}
