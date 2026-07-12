import type { Difficulty, ProteinClass, Slot } from "../types";

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
export const SLOTS: Slot[] = ["breakfast", "lunch", "dinner"];

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
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}
