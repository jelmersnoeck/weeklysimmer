// Client-side diet conflict detection. Mirrors the backend's rules so the
// settings screen can highlight clashes live, before the user saves. The server
// also returns its own conflicts on save; this is purely for instant feedback.
// A protein counts as "selected" when its frequency is not "never".

import type { DietConflict, Settings } from "../types";
import { labelize } from "./labels";

// Proteins that are neither vegetarian nor vegan (meat + fish + shellfish).
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

// Land meat only — fish/shellfish are allowed on a pescatarian diet.
const LAND_MEAT = new Set(["chicken", "turkey", "beef", "pork", "lamb"]);

function selectedProteins(settings: Settings): string[] {
  return settings.proteins
    .filter((p) => p.frequency !== "never")
    .map((p) => p.key);
}

export function dietConflicts(settings: Settings): DietConflict[] {
  const conflicts: DietConflict[] = [];
  const selected = selectedProteins(settings);
  const flavours = new Set(settings.flavoursLiked);
  const dishes = new Set(settings.dishTypesLiked);

  switch (settings.diet) {
    case "vegetarian": {
      for (const key of selected) {
        if (MEAT_AND_FISH.has(key)) {
          conflicts.push({
            field: "proteins",
            key,
            message: `${labelize(key)} isn't vegetarian`,
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
            message: `${labelize(key)} isn't vegan`,
          });
        }
      }
      if (flavours.has("cheesy")) {
        conflicts.push({
          field: "flavours",
          key: "cheesy",
          message: "Cheese isn't vegan",
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
            message: `${labelize(key)} isn't pescatarian`,
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
          message: "Beans are high-FODMAP",
        });
      }
      if (flavours.has("garlicky")) {
        conflicts.push({
          field: "flavours",
          key: "garlicky",
          message: "Garlic is high-FODMAP",
        });
      }
      break;
    }
    case "gluten_free": {
      if (dishes.has("pasta")) {
        conflicts.push({
          field: "dishTypes",
          key: "pasta",
          message: "Pasta usually contains gluten",
        });
      }
      if (dishes.has("wraps_tacos")) {
        conflicts.push({
          field: "dishTypes",
          key: "wraps_tacos",
          message: "Wraps/tacos usually contain gluten",
        });
      }
      break;
    }
    case "dairy_free": {
      if (flavours.has("cheesy")) {
        conflicts.push({
          field: "flavours",
          key: "cheesy",
          message: "Cheese isn't dairy-free",
        });
      }
      if (flavours.has("creamy")) {
        conflicts.push({
          field: "flavours",
          key: "creamy",
          message: "Creamy dishes often use dairy",
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
