// Render an ingredient / shopping quantity honouring the household's chosen
// measurement systems. Metric is the canonical figure; a cup measure is shown
// alongside (or instead) when the user asked for cups.

import type { MeasurementSystem } from "../types";

interface Measurable {
  quantity: number;
  unit: string;
  cupQuantity?: number;
  cupUnit?: string;
}

// Common cup fractions rendered as tidy glyphs; anything else falls back to a
// short decimal.
const FRACTION_GLYPHS: Record<string, string> = {
  "0.25": "¼",
  "0.33": "⅓",
  "0.5": "½",
  "0.67": "⅔",
  "0.75": "¾",
};

function formatCupNumber(n: number): string {
  const whole = Math.floor(n);
  const glyph = FRACTION_GLYPHS[(n - whole).toFixed(2)];
  if (glyph) return whole > 0 ? `${whole}${glyph}` : glyph;
  // Round to 2dp and drop trailing zeros: 0.5 -> "0.5", 1 -> "1".
  return String(Math.round(n * 100) / 100);
}

function metricText(item: Measurable): string {
  return `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`;
}

function cupText(item: Measurable): string | null {
  if (item.cupQuantity == null) return null;
  const qty = formatCupNumber(item.cupQuantity);
  return `${qty}${item.cupUnit ? ` ${item.cupUnit}` : ""}`;
}

export function formatQuantity(
  item: Measurable,
  units: MeasurementSystem[],
): string {
  const wantsMetric = units.includes("metric");
  const wantsCups = units.includes("cups");
  const cups = cupText(item);

  // Both systems: metric first, then the cup measure when one exists.
  if (wantsMetric && wantsCups && cups) {
    return `${metricText(item)} · ${cups}`;
  }
  // Cups only: use the cup measure, else fall back to metric.
  if (wantsCups && !wantsMetric && cups) {
    return cups;
  }
  // Metric only, or no cup measure available.
  return metricText(item);
}
