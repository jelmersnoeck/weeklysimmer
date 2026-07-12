import type { Diet, Settings } from "./types.js";

/**
 * A non-blocking warning that a selected preference clashes with the chosen diet.
 * Surfaced to the user (e.g. after PUT /api/settings) but never rejects the save —
 * explicit selections always win; we just point out the tension.
 */
export interface DietConflict {
  field: "proteins" | "flavours" | "dishTypes";
  key: string;
  message: string;
}

/** Proteins that are neither vegetarian nor vegan (meat + fish + shellfish). */
const MEAT_AND_FISH = new Set([
  "chicken",
  "turkey",
  "beef",
  "pork",
  "lamb",
  "white_fish",
  "salmon",
  "tuna",
  "shellfish",
]);

/** Land meat only (fish/shellfish allowed on a pescatarian diet). */
const LAND_MEAT = new Set(["chicken", "turkey", "beef", "pork", "lamb"]);

/** Turn a canonical protein key into readable words for messages. */
function label(key: string): string {
  if (key === "halloumi_paneer") return "halloumi/paneer";
  return key.replace(/_/g, " ");
}

/** The protein keys the household actually wants (frequency !== "never"). */
function selectedProteins(settings: Settings): string[] {
  return settings.proteins.filter((p) => p.frequency !== "never").map((p) => p.key);
}

/** Conflicts for a SINGLE diet framework, given the household's concrete selections. */
function conflictsForDiet(
  diet: Diet,
  selected: string[],
  likes: Set<string>,
): DietConflict[] {
  const conflicts: DietConflict[] = [];

  switch (diet) {
    case "vegetarian": {
      for (const key of selected) {
        if (MEAT_AND_FISH.has(key)) {
          conflicts.push({
            field: "proteins",
            key,
            message: `${label(key)} isn't vegetarian`,
          });
        }
      }
      break;
    }
    case "vegan": {
      for (const key of selected) {
        if (MEAT_AND_FISH.has(key) || key === "eggs" || key === "halloumi_paneer") {
          conflicts.push({
            field: "proteins",
            key,
            message: `${label(key)} isn't vegan`,
          });
        }
      }
      if (likes.has("cheesy")) {
        conflicts.push({
          field: "flavours",
          key: "cheesy",
          message: "cheese isn't vegan",
        });
      }
      break;
    }
    case "pescatarian": {
      for (const key of selected) {
        if (LAND_MEAT.has(key)) {
          conflicts.push({
            field: "proteins",
            key,
            message: `${label(key)} isn't pescatarian`,
          });
        }
      }
      break;
    }
    case "low_fodmap": {
      if (selected.includes("beans_legumes")) {
        conflicts.push({
          field: "proteins",
          key: "beans_legumes",
          message: "beans are high-FODMAP",
        });
      }
      if (likes.has("garlicky")) {
        conflicts.push({
          field: "flavours",
          key: "garlicky",
          message: "garlic is high-FODMAP",
        });
      }
      break;
    }
  }

  return conflicts;
}

/**
 * Compute non-blocking diet warnings for a settings profile. Each selected diet
 * framework contributes its own conflicts (checked against the user's concrete
 * selections); the results are UNIONED across all `settings.diets` and deduped by
 * (field, key) so a key flagged by two diets only appears once. An empty `diets`
 * array (no framework) yields no conflicts.
 */
export function dietConflicts(settings: Settings): DietConflict[] {
  const selected = selectedProteins(settings);
  const likes = new Set(settings.flavoursLiked);

  const merged = new Map<string, DietConflict>();
  for (const diet of settings.diets) {
    for (const c of conflictsForDiet(diet, selected, likes)) {
      const dedupeKey = `${c.field}|${c.key}`;
      if (!merged.has(dedupeKey)) merged.set(dedupeKey, c);
    }
  }

  return [...merged.values()];
}
