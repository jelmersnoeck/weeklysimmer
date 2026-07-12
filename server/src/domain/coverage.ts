import type { Meal } from "./types.js";

/**
 * Which delivered vegetables never made it into any meal — the waste warning.
 *
 * The veg box lists vegetable TYPES ("carrots", "leek", "spinach"). Recipe
 * ingredients name the same thing more loosely ("carrot, grated", "baby spinach",
 * "leeks"). So a naive exact match would wrongly flag everything as unused.
 *
 * DESIGN DECISION (yours): how forgiving is the match? The tests in coverage.test.ts
 * expect at least case-insensitive + singular/plural + substring matching, so that
 * box "carrots" is considered used when a meal lists "carrot" or "baby carrots".
 * Implement a `matches(vegName, ingredientName)` notion and return the box items
 * with NO matching ingredient. Preserve the original box spelling in the output.
 *
 * @returns the subset of `vegBox` (original casing) that no meal used.
 */
export function unusedVegetables(vegBox: string[], meals: Meal[]): string[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const stripPlural = (s: string) => (s.endsWith("s") ? s.slice(0, -1) : s);

  const ingredientNames = meals.flatMap((m) => m.ingredients.map((i) => norm(i.name)));

  const isUsed = (veg: string): boolean => {
    const base = stripPlural(norm(veg));
    return ingredientNames.some((n) => n.includes(base) || stripPlural(n).includes(base));
  };

  return vegBox.filter((veg) => !isUsed(veg));
}
