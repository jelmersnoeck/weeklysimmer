import type { Meal, Slot } from "./types.js";
import { SLOTS } from "./schedule.js";

/**
 * Which meals a mid-week adjustment is allowed to change. Everything NOT in the
 * adjustable region is treated as fixed context — the LLM keeps it and won't repeat it.
 *
 * - `from`: a time-based cut-off — everything at or after the (day, slot) cell is
 *   adjustable, the earlier meals are frozen ("already eaten").
 * - `days`: only the listed day indices (0=Mon..6=Sun) are adjustable; every other day
 *   stays fixed. Used to edit specific days like "just Tuesday".
 */
export type AdjustScope =
  | { kind: "from"; day: number; slot: Slot }
  | { kind: "days"; days: number[] };

/** Position of a slot within a day (breakfast=0 … dinner=4). */
export function slotOrdinal(slot: Slot): number {
  return SLOTS.indexOf(slot);
}

/**
 * A single comparable ordinal for a (day, slot) cell, so cut-off comparisons are one
 * numeric check. Slots span 0–4, so `day * 10` keeps days apart.
 */
export function cellOrdinal(day: number, slot: Slot): number {
  return day * 10 + slotOrdinal(slot);
}

/** Whether a (day, slot) cell falls inside the scope's adjustable region. */
export function isAdjustable(
  day: number,
  slot: Slot,
  scope: AdjustScope,
): boolean {
  if (scope.kind === "days") return scope.days.includes(day);
  return cellOrdinal(day, slot) >= cellOrdinal(scope.day, scope.slot);
}

/** Stable key for a (day, slot) cell. */
function cellKey(day: number, slot: Slot): string {
  return `${day}:${slot}`;
}

/**
 * Split a week's meals into the fixed region (kept, never repeated) and the adjustable
 * region (the cells a directional note may change), using the scope.
 *
 * The adjustable region also includes **leftover dependents**: a meal that reuses a
 * scoped meal (its `leftoverOf` points at an in-scope cell) MUST be changeable too —
 * otherwise editing e.g. Monday's dinner would strand Tuesday's "leftover of Monday"
 * lunch as a stale reference the guard would refuse to update.
 */
export function partitionMeals(
  meals: Meal[],
  scope: AdjustScope,
): { fixed: Meal[]; adjustable: Meal[] } {
  const scopedCells = new Set(
    meals
      .filter((m) => isAdjustable(m.day, m.slot, scope))
      .map((m) => cellKey(m.day, m.slot)),
  );
  const dependsOnScope = (m: Meal): boolean =>
    m.leftoverOf != null &&
    scopedCells.has(cellKey(m.leftoverOf.day, m.leftoverOf.slot));

  const fixed: Meal[] = [];
  const adjustable: Meal[] = [];
  for (const m of meals) {
    if (isAdjustable(m.day, m.slot, scope) || dependsOnScope(m)) {
      adjustable.push(m);
    } else {
      fixed.push(m);
    }
  }
  return { fixed, adjustable };
}
