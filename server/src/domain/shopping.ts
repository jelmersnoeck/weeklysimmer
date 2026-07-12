import type { Meal, ShoppingItem } from "./types.js";
import { toBaseUnit, baseUnit } from "./units.js";

/**
 * Aggregate every ingredient across all meals into one shopping list.
 *
 * The ingredients passed in are already portion-scaled (see scaleIngredient), so
 * this function only has to MERGE and GROUP — no scaling here.
 *
 * DESIGN DECISIONS (yours) — the tests in shopping.test.ts encode one reasonable
 * set; change the tests too if you choose differently:
 *   1. Group by ingredient name (case-insensitive). "Rice" and "rice" are the same buy.
 *   2. Merging quantities within a name:
 *      - If two entries share a convertible dimension (both mass, or both volume),
 *        sum them in the BASE unit (g / ml) via toBaseUnit()/baseUnit().
 *        e.g. 1 kg + 200 g chicken -> 1200 g.
 *      - If they share the exact same non-convertible unit (e.g. both "clove"),
 *        sum keeping that unit. e.g. 2 clove + 1 clove -> 3 clove.
 *      - If the units are incompatible (e.g. "clove" + "g" for the same name),
 *        keep them as SEPARATE lines rather than silently adding unlike things.
 *   3. Every item starts unchecked.
 *   4. Sort the result by category (aisle), then by name, for a tidy list.
 *
 * @returns the consolidated, grouped, sorted shopping list.
 */
export function buildShoppingList(meals: Meal[]): ShoppingItem[] {
  const groups = new Map<
    string,
    { name: string; category: string; unit: string; total: number }
  >();

  for (const m of meals) {
    for (const ing of m.ingredients) {
      const nameLower = ing.name.trim().toLowerCase();
      const converted = toBaseUnit(ing.quantity, ing.unit);

      let key: string;
      let unit: string;
      let amount: number;
      if (converted) {
        // Convertible: merge all mass (or all volume) entries in the base unit.
        key = `${nameLower}|${converted.dimension}`;
        unit = baseUnit(converted.dimension);
        amount = converted.value;
      } else {
        // Non-convertible: only merge entries sharing the exact same unit.
        const unitLower = ing.unit.trim().toLowerCase();
        key = `${nameLower}|${unitLower}`;
        unit = ing.unit;
        amount = ing.quantity;
      }

      const existing = groups.get(key);
      if (existing) {
        existing.total += amount;
      } else {
        groups.set(key, { name: ing.name, category: ing.category, unit, total: amount });
      }
    }
  }

  return [...groups.values()]
    .map((g) => ({
      name: g.name,
      totalQuantity: g.total,
      unit: g.unit,
      category: g.category,
      checked: false,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}
