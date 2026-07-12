import type { Meal } from "../types";

// Parse the free-text "foods to use up" field into a clean list.
// Splits on newlines AND commas, trims whitespace, drops empties, and dedupes
// case-insensitively while preserving the first spelling seen.
export function parseOnHand(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/[\n,]/)) {
    const item = raw.trim();
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// Crude singularizer, enough to match "carrots" against "carrot". Order matters:
// ies -> y before es -> "" before s -> "".
function singularize(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.endsWith("es")) return w.slice(0, -2);
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}

// Which of the on-hand foods actually turn up in this meal's ingredient names.
// Matches case-insensitively with a little singular/plural tolerance: an on-hand
// term hits when an ingredient name contains its singular form (or vice-versa).
// Returns the on-hand items (in their original spelling) that matched.
export function mealUsesOnHand(meal: Meal, onHand: string[]): string[] {
  const names = meal.ingredients.map((i) => i.name.toLowerCase());
  const out: string[] = [];
  for (const item of onHand) {
    const term = singularize(item);
    if (!term) continue;
    const used = names.some((name) => {
      const singularName = singularize(name);
      return (
        name.includes(term) ||
        singularName.includes(term) ||
        (singularName.length > 0 && term.includes(singularName))
      );
    });
    if (used) out.push(item);
  }
  return out;
}
