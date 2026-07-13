import type { Meal, ShoppingItem } from "./types.js";
import { toBaseUnit, baseUnit } from "./units.js";
import { canonicalCategory } from "./categories.js";
import { singularize } from "./text.js";

/**
 * One thing to buy before merging: a quantity with a unit, a category, the display
 * name to show on the output line, and the case-insensitive KEY it groups under.
 * `groupKey` is what buckets lines together (the singularized ingredient name when
 * building, or the canonical name when consolidating).
 */
interface MergeEntry {
  groupKey: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  cupQuantity?: number;
  cupUnit?: string;
}

/**
 * Core merge used by BOTH buildShoppingList and consolidateShoppingList — the single
 * source of truth for how quantities combine:
 *   - Convertible units (mass/volume) sum in the BASE unit (g / ml) via units.ts.
 *   - Matching non-convertible units (e.g. both "clove") sum keeping that unit.
 *   - Incompatible units for the same group stay as SEPARATE lines.
 *   - cupQuantity is additive across entries sharing the same cupUnit.
 * The first-seen entry in a bucket supplies the display name and category. Output is
 * unsorted (callers sort) so the two callers can share this arithmetic exactly.
 */
function mergeEntries(entries: MergeEntry[]): ShoppingItem[] {
  const groups = new Map<
    string,
    {
      name: string;
      category: string;
      unit: string;
      total: number;
      cupUnit?: string;
      cupTotal?: number;
    }
  >();

  for (const e of entries) {
    const converted = toBaseUnit(e.quantity, e.unit);

    let key: string;
    let unit: string;
    let amount: number;
    if (converted) {
      // Convertible: merge all mass (or all volume) entries in the base unit.
      key = `${e.groupKey}|${converted.dimension}`;
      unit = baseUnit(converted.dimension);
      amount = converted.value;
    } else {
      // Non-convertible: only merge entries sharing the exact same unit.
      const unitLower = e.unit.trim().toLowerCase();
      key = `${e.groupKey}|${unitLower}`;
      unit = e.unit;
      amount = e.quantity;
    }

    const hasCup = e.cupQuantity !== undefined && e.cupUnit !== undefined;

    const existing = groups.get(key);
    if (existing) {
      existing.total += amount;
      // Same group → cups are additive as long as they use the same cup unit.
      if (hasCup) {
        if (existing.cupUnit === undefined) {
          existing.cupUnit = e.cupUnit;
          existing.cupTotal = e.cupQuantity;
        } else if (existing.cupUnit === e.cupUnit) {
          existing.cupTotal = (existing.cupTotal ?? 0) + e.cupQuantity!;
        }
      }
    } else {
      groups.set(key, {
        name: e.name,
        category: e.category,
        unit,
        total: amount,
        ...(hasCup ? { cupUnit: e.cupUnit, cupTotal: e.cupQuantity } : {}),
      });
    }
  }

  return [...groups.values()].map((g) => ({
    name: g.name,
    totalQuantity: g.total,
    unit: g.unit,
    category: g.category,
    checked: false,
    ...(g.cupTotal !== undefined && g.cupUnit !== undefined
      ? { cupQuantity: g.cupTotal, cupUnit: g.cupUnit }
      : {}),
  }));
}

/** Sort a shopping list by category (aisle) then name — shared by both builders. */
function sortShoppingItems(items: ShoppingItem[]): ShoppingItem[] {
  return [...items].sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

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
  const entries: MergeEntry[] = [];

  for (const m of meals) {
    // Leftover meals reuse food already bought for their source meal, so they must
    // not add to the shopping list — otherwise the reused protein/veg is bought twice.
    if (m.leftoverOf) continue;
    for (const ing of m.ingredients) {
      entries.push({
        // Merge on the SINGULARIZED name so "egg"/"eggs" and "carrot"/"carrots" fold
        // into one line; the first-seen display name is kept by mergeEntries.
        groupKey: singularize(ing.name.trim().toLowerCase()),
        name: ing.name,
        category: canonicalCategory(ing.name, ing.category),
        quantity: ing.quantity,
        unit: ing.unit,
        cupQuantity: ing.cupQuantity,
        cupUnit: ing.cupUnit,
      });
    }
  }

  return sortShoppingItems(mergeEntries(entries));
}

/**
 * Leading prep/variety adjectives that describe the SAME grocery item — stripping
 * them lets "jasmine rice" or "baby spinach" match an on-hand "rice"/"spinach".
 *
 * Deliberately EXCLUDES words that make a genuinely DIFFERENT product: "brown"
 * (brown rice), "red"/"green", "sweet" (sweet potato), "spring" (spring onion).
 * Those must NOT be dropped, or we'd wrongly cross-off a distinct item.
 */
const ON_HAND_DESCRIPTORS = new Set([
  "cooked",
  "jasmine",
  "white",
  "basmati",
  "fresh",
  "chopped",
  "grated",
  "baby",
  "canned",
  "tinned",
  "ground",
  "minced",
  "dried",
  "frozen",
  "raw",
  "unsalted",
  "salted",
]);

/** Lowercase, split on whitespace, singularize each token. */
function normalizeTokens(name: string): string[] {
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map(singularize);
}

/**
 * The head noun of a name: its singularized tokens with any leading prep/variety
 * descriptors removed. "jasmine rice" -> "rice", "baby spinach" -> "spinach",
 * "sweet potato" -> "sweet potato" (sweet is not a descriptor), "carrots" -> "carrot".
 * Always keeps at least one token.
 */
function stripDescriptors(name: string): string {
  const tokens = normalizeTokens(name);
  while (tokens.length > 1 && ON_HAND_DESCRIPTORS.has(tokens[0])) tokens.shift();
  return tokens.join(" ");
}

/**
 * Does a shopping item match an on-hand term? Tolerant but conservative: both
 * sides are lowercased, singularized, and have leading prep/variety descriptors
 * stripped, then compared for EQUALITY. So "Carrots"↔"carrot" and "jasmine
 * rice"↔"rice" match, but "sweet potato"↔"potato", "brown rice"↔"rice" and
 * "spring onion"↔"onion" do NOT (those descriptors aren't stripped).
 */
export function matchesOnHand(itemName: string, term: string): boolean {
  return stripDescriptors(itemName) === stripDescriptors(term);
}

/**
 * Split a shopping list into what still needs buying vs. what the household already
 * has. An item is EXCLUDED when its name matches any on-hand term (see matchesOnHand).
 *
 * @returns `toBuy` (items matching no on-hand term, order preserved) and
 *   `alreadyHave` (the on-hand terms that matched at least one item — for the UI).
 */
export function excludeOnHand(
  items: ShoppingItem[],
  onHand: string[],
): { toBuy: ShoppingItem[]; alreadyHave: string[] } {
  const terms = onHand.map((t) => t.trim()).filter((t) => t.length > 0);
  const toBuy: ShoppingItem[] = [];
  const matched = new Set<string>();

  for (const it of items) {
    const term = terms.find((t) => matchesOnHand(it.name, t));
    if (term === undefined) {
      toBuy.push(it);
    } else {
      matched.add(term);
    }
  }

  return { toBuy, alreadyHave: terms.filter((t) => matched.has(t)) };
}

/**
 * Re-merge an already-built shopping list after an LLM consolidation review.
 *
 * The LLM ONLY named things — for each item it returned a `canonical` grocery-product
 * name (see buildConsolidationPrompt). This function does all the arithmetic: it groups
 * items by canonical name and re-merges their quantities with the EXACT same rules as
 * buildShoppingList (unit-dimension aware, incompatible units stay separate, cups sum).
 *
 *   - Name lookup is case-insensitive on the item name; an item missing from the
 *     mapping is its own canonical (name unchanged).
 *   - Output line `name` is the canonical; `category` is the first item's category in
 *     the group; `checked` is false.
 *   - Sorted like buildShoppingList (category then name).
 */
export function consolidateShoppingList(
  items: ShoppingItem[],
  mapping: Array<{ name: string; canonical: string }>,
): ShoppingItem[] {
  const lookup = new Map<string, string>();
  for (const m of mapping) {
    lookup.set(m.name.trim().toLowerCase(), m.canonical);
  }

  const entries: MergeEntry[] = items.map((it) => {
    const canonical = lookup.get(it.name.trim().toLowerCase()) ?? it.name;
    return {
      groupKey: canonical.trim().toLowerCase(),
      name: canonical,
      // The list is already built, so categories are final — take the first-seen one.
      category: it.category,
      quantity: it.totalQuantity,
      unit: it.unit,
      cupQuantity: it.cupQuantity,
      cupUnit: it.cupUnit,
    };
  });

  return sortShoppingItems(mergeEntries(entries));
}
