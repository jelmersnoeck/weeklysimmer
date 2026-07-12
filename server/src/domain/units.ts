// Unit normalization for merging shopping-list quantities.
//
// Only mass and volume are convertible here. Count-style units (clove, piece,
// tbsp, ...) are intentionally NOT converted — "2 tbsp" and "30 ml" are not
// safely interchangeable without density data we don't have, so the shopping
// aggregator treats non-convertible units as mergeable only when they match
// exactly.

export type Dimension = "mass" | "volume";

const MASS: Record<string, number> = {
  g: 1, gram: 1, grams: 1,
  kg: 1000, kilo: 1000, kilos: 1000, kilogram: 1000, kilograms: 1000,
};

const VOLUME: Record<string, number> = {
  ml: 1, milliliter: 1, milliliters: 1, millilitre: 1, millilitres: 1,
  l: 1000, liter: 1000, liters: 1000, litre: 1000, litres: 1000,
};

function normalize(unit: string): string {
  return unit.trim().toLowerCase();
}

/** Which convertible dimension a unit belongs to, or null if it isn't mass/volume. */
export function dimensionOf(unit: string): Dimension | null {
  const u = normalize(unit);
  if (u in MASS) return "mass";
  if (u in VOLUME) return "volume";
  return null;
}

/** The canonical base unit symbol for a dimension ("g" for mass, "ml" for volume). */
export function baseUnit(dimension: Dimension): string {
  return dimension === "mass" ? "g" : "ml";
}

/**
 * Convert a quantity to the base unit of its dimension (grams or millilitres).
 * Returns null when the unit is not a known mass/volume unit — the caller should
 * then fall back to exact-unit matching.
 */
export function toBaseUnit(
  quantity: number,
  unit: string,
): { value: number; dimension: Dimension } | null {
  const u = normalize(unit);
  if (u in MASS) return { value: quantity * MASS[u], dimension: "mass" };
  if (u in VOLUME) return { value: quantity * VOLUME[u], dimension: "volume" };
  return null;
}
