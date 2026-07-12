/**
 * Shelf-stable / bulk-bought goods should group under their own shopping aisle
 * ("bulk_staples") rather than being scattered across "grains", "pantry", "fish",
 * etc. These are dry starches and canned/jarred goods you typically buy in bulk and
 * keep in the cupboard, separate from perishable pantry items.
 *
 * The match is a case-insensitive SUBSTRING test on the ingredient name, so
 * "jasmine rice", "cooked rice" and "basmati rice" all match "rice", and
 * "canned tuna" matches "canned".
 */
const BULK_STAPLE_KEYWORDS: readonly string[] = [
  // dry starches
  "rice",
  "pasta",
  "spaghetti",
  "penne",
  "noodle",
  "oats",
  "oatmeal",
  "flour",
  "couscous",
  "quinoa",
  "lentil",
  // bulk fats & coatings — bought in bulk and reused across weeks
  "butter",
  "breadcrumb",
  "bread crumb",
  "panko",
  // canned / jarred shelf-stable goods
  "canned",
  "tinned",
  "tin of",
  "coconut milk",
  "passata",
  "stock cube",
  "stock pot",
  "bouillon",
  "chickpea",
];

/**
 * Canonicalize an ingredient's shopping category. If the ingredient NAME matches a
 * known bulk/shelf-stable keyword, the item belongs in the "bulk_staples" aisle;
 * otherwise the raw category is returned unchanged.
 */
export function canonicalCategory(name: string, rawCategory: string): string {
  const lower = name.toLowerCase();
  if (BULK_STAPLE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "bulk_staples";
  }
  return rawCategory;
}
