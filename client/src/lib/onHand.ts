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
