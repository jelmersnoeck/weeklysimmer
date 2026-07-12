import type { Settings } from "./types.js";

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

/**
 * Compute non-blocking diet warnings for a settings profile. Each rule checks the
 * user's concrete selections (selected proteins, liked flavours/dish types) against
 * the chosen diet and returns a friendly message. `none` yields no conflicts.
 */
export function dietConflicts(settings: Settings): DietConflict[] {
  const conflicts: DietConflict[] = [];
  const selected = selectedProteins(settings);
  const likes = new Set(settings.flavoursLiked);
  const dishes = new Set(settings.dishTypesLiked);

  switch (settings.diet) {
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
    case "gluten_free": {
      if (dishes.has("pasta")) {
        conflicts.push({
          field: "dishTypes",
          key: "pasta",
          message: "pasta usually contains gluten",
        });
      }
      if (dishes.has("wraps_tacos")) {
        conflicts.push({
          field: "dishTypes",
          key: "wraps_tacos",
          message: "wraps/tacos usually contain gluten",
        });
      }
      break;
    }
    case "dairy_free": {
      if (likes.has("cheesy")) {
        conflicts.push({
          field: "flavours",
          key: "cheesy",
          message: "cheese isn't dairy-free",
        });
      }
      if (likes.has("creamy")) {
        conflicts.push({
          field: "flavours",
          key: "creamy",
          message: "creamy dishes often use dairy",
        });
      }
      break;
    }
    case "lactose_free": {
      // Hard cheeses/butter are low-lactose, so "cheesy" is fine; milk/cream are high.
      if (likes.has("creamy")) {
        conflicts.push({
          field: "flavours",
          key: "creamy",
          message: "creamy dishes are often high in lactose",
        });
      }
      break;
    }
    case "none":
    default:
      break;
  }

  return conflicts;
}
