// Turn a canonical snake_case key into a human-readable label. Used everywhere
// the UI displays a preference key (proteins, cuisines, diets, appetites, …).

// Keys whose display form doesn't follow the plain Title-Case rule.
const SPECIAL: Record<string, string> = {
  white_fish: "White fish",
  beans_legumes: "Beans & legumes",
  halloumi_paneer: "Halloumi / paneer",
  low_fodmap: "Low-FODMAP",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  lactose_free: "Lactose-free",
  very_active: "Very active",
  stir_fry: "Stir-fry",
  tray_bake: "Tray-bake",
  grain_bowl: "Grain bowl",
  wraps_tacos: "Wraps & tacos",
  middle_eastern: "Middle Eastern",
  bell_pepper: "Bell pepper",
  green_beans: "Green beans",
  sweet_potato: "Sweet potato",
};

export function labelize(key: string): string {
  if (key in SPECIAL) return SPECIAL[key];
  // Title-case the first word only, keep the rest lower — "grain bowl" style.
  const words = key.split("_");
  return words
    .map((word, i) =>
      i === 0 && word.length > 0
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word,
    )
    .join(" ");
}
