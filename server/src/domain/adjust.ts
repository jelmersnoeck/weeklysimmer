import type { Meal, Slot } from "./types.js";
import { SLOTS } from "./schedule.js";

/** A freeze boundary: everything strictly before this (day, slot) is frozen. */
export interface Cutoff {
  day: number;
  slot: Slot;
}

/** Position of a slot within a day (breakfast=0 … dinner=4). */
export function slotOrdinal(slot: Slot): number {
  return SLOTS.indexOf(slot);
}

/**
 * A single comparable ordinal for a (day, slot) cell, so "is this cell before the
 * cutoff?" is one numeric comparison. Slots span 0–4, so `day * 10` keeps days apart.
 */
export function cellOrdinal(day: number, slot: Slot): number {
  return day * 10 + slotOrdinal(slot);
}

/** A cell is frozen when it sits strictly BEFORE the cutoff cell. */
export function isFrozen(day: number, slot: Slot, cutoff: Cutoff): boolean {
  return cellOrdinal(day, slot) < cellOrdinal(cutoff.day, cutoff.slot);
}

/**
 * Split a week's meals into the frozen (already-eaten) region and the adjustable
 * (still-to-come) region, using the cutoff. Frozen meals are left untouched by an
 * adjustment; adjustable meals are the ones a directional note may change.
 */
export function partitionMeals(
  meals: Meal[],
  cutoff: Cutoff,
): { frozen: Meal[]; adjustable: Meal[] } {
  const frozen: Meal[] = [];
  const adjustable: Meal[] = [];
  for (const m of meals) {
    if (isFrozen(m.day, m.slot, cutoff)) frozen.push(m);
    else adjustable.push(m);
  }
  return { frozen, adjustable };
}
