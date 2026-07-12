import type { Difficulty, Meal, ProteinClass, Slot } from "../types";

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LABELS_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
// Canonical slot order for the week board, in display order.
export const SLOT_ORDER: Slot[] = [
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "dinner",
];

// Backwards-compatible alias — the board renders SLOT_ORDER.
export const SLOTS: Slot[] = SLOT_ORDER;

export const SLOT_LABELS: Record<Slot, string> = {
  breakfast: "Breakfast",
  morning_snack: "Morning snack",
  lunch: "Lunch",
  afternoon_snack: "Afternoon snack",
  dinner: "Dinner",
};

export const PROTEIN_LABELS: Record<ProteinClass, string> = {
  lean: "Lean",
  red_or_high_fat: "Red / rich",
  vegetarian: "Veg",
};

export function proteinTagVariant(p: ProteinClass): string {
  if (p === "vegetarian") return "tag--veg";
  if (p === "red_or_high_fat") return "tag--red";
  return "";
}

export function difficultyLabel(d: Difficulty): string {
  return d.charAt(0).toUpperCase() + d.slice(1);
}

export function slotLabel(slot: Slot): string {
  return SLOT_LABELS[slot] ?? slot.charAt(0).toUpperCase() + slot.slice(1);
}

// Total active time for a meal, or null when neither prep nor cook is known
// (older saved meals may lack these fields).
export function mealTotalMinutes(meal: Meal): number | null {
  if (meal.prepMinutes == null && meal.cookMinutes == null) return null;
  return (meal.prepMinutes ?? 0) + (meal.cookMinutes ?? 0);
}
