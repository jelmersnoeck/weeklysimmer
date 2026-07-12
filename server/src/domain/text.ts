/**
 * Naive English singularization for grouping ingredient names.
 *
 * The shopping aggregator merges on the SINGULARIZED name so "egg" and "eggs" (or
 * "carrot"/"carrots") land on one line. This is intentionally simple — it only needs
 * to fold common plural spellings of the same ingredient, not be linguistically
 * complete:
 *   - "…ies" → "…y"   (berries → berry)
 *   - "…es"  → "…"    (tomatoes → tomato)
 *   - "…s"   → "…"    (eggs → egg)
 * Words that don't end in "s" are returned unchanged.
 */
export function singularize(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith("ies") && word.length > 3) return word.slice(0, -3) + "y";
  if (lower.endsWith("es") && word.length > 2) return word.slice(0, -2);
  if (lower.endsWith("s") && word.length > 1) return word.slice(0, -1);
  return word;
}
