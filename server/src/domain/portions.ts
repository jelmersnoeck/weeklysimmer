import type { HouseholdMember, Ingredient } from "./types.js";

/**
 * How many whole servings to cook for the household.
 *
 * Each member has a `consumptionFactor` in adult-equivalents (an active adult is
 * ~1.15, a toddler ~0.5). Sum them, then decide a rounding rule.
 *
 * DESIGN DECISION (yours): recipes come in whole servings, so 2.8 adult-equivalents
 * can't map to "2.8 servings". Rounding UP (→3) means nobody goes hungry but you
 * cook a bit extra (which conveniently feeds the leftover-lunch strategy). Rounding
 * to nearest (→3 here, but 2.4 → 2) risks a short dinner. Pick and implement one.
 *
 * @returns a positive integer number of servings.
 */
export function householdServings(members: HouseholdMember[]): number {
  const total = members.reduce((sum, m) => sum + m.consumptionFactor, 0);
  // Round UP so nobody goes hungry; the small surplus feeds the leftover-lunch strategy.
  return Math.max(1, Math.ceil(total));
}

/**
 * Scale a single-serving ingredient up to `servings`.
 *
 * Ingredient quantities from the LLM are normalized to ONE serving; multiply by
 * the household serving count so the shopping list reflects what to actually buy.
 */
export function scaleIngredient(ing: Ingredient, servings: number): Ingredient {
  return { ...ing, quantity: ing.quantity * servings };
}
