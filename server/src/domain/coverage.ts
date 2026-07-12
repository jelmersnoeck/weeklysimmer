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
  // Reduce common English plurals to a singular stem: ies->y, es->'', s->''.
  const singularize = (w: string): string => {
    if (w.endsWith("ies")) return w.slice(0, -3) + "y";
    if (w.endsWith("es")) return w.slice(0, -2);
    if (w.endsWith("s")) return w.slice(0, -1);
    return w;
  };
  // Split a name into singularized word tokens (e.g. "grated carrots" -> ["grated","carrot"]).
  const tokens = (s: string): string[] =>
    s.trim().toLowerCase().split(/[^a-z]+/).filter(Boolean).map(singularize);

  // The set of every singularized word appearing in any ingredient name.
  const usedWords = new Set(meals.flatMap((m) => m.ingredients.flatMap((i) => tokens(i.name))));

  // A box veg counts as used if its head noun (last word) appears as an ingredient
  // word — whole-word matching, so "peas" (pea) does NOT match "peanut", and
  // "tomatoes" (tomato) DOES match "grated tomato".
  const isUsed = (veg: string): boolean => {
    const words = tokens(veg);
    const head = words[words.length - 1];
    return head != null && usedWords.has(head);
  };

  return vegBox.filter((veg) => !isUsed(veg));
}
