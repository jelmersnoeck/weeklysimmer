import type { EnabledSlot, MealSchedule, Slot } from "./types.js";

/** The five slots in display order (breakfast → dinner). */
export const SLOTS: readonly Slot[] = [
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "dinner",
];

/** A meal schedule with every day/slot cell enabled (the user default). */
export function defaultMealSchedule(): MealSchedule {
  const allWeek = (): boolean[] => Array.from({ length: 7 }, () => true);
  return {
    breakfast: allWeek(),
    morning_snack: allWeek(),
    lunch: allWeek(),
    afternoon_snack: allWeek(),
    dinner: allWeek(),
  };
}

/**
 * Flatten a meal schedule into the list of enabled (day, slot) cells, in a readable
 * day-major order (day 0 first, slots in display order within each day). Cells whose
 * boolean is false (or missing) are excluded.
 */
export function enabledSlotsFromSchedule(schedule: MealSchedule): EnabledSlot[] {
  const enabled: EnabledSlot[] = [];
  for (let day = 0; day < 7; day++) {
    for (const slot of SLOTS) {
      if (schedule[slot]?.[day]) {
        enabled.push({ day, slot });
      }
    }
  }
  return enabled;
}
