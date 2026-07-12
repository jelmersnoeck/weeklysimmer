// Client-side diet conflict detection. Mirrors the backend's rules so the
// settings screen can highlight clashes live, before the user saves. The server
// also returns its own conflicts on save; this is purely for instant feedback.
// A protein counts as "selected" when its frequency is not "never".

import type { Diet, DietConflict, Settings } from "../types";
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

// Conflicts for a single diet framework. The public dietConflicts() unions
// these across every selected diet and dedupes by field|key.
function conflictsForDiet(diet: Diet, settings: Settings): DietConflict[] {
  const conflicts: DietConflict[] = [];
  const selected = selectedProteins(settings);
  const flavours = new Set(settings.flavoursLiked);

  switch (diet) {
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
  }

  return conflicts;
}

// Union of the conflicts across every selected diet, deduped by field|key.
// Zero selected diets means no framework and so no conflicts.
export function dietConflicts(settings: Settings): DietConflict[] {
  const out: DietConflict[] = [];
  const seen = new Set<string>();
  for (const diet of settings.diets) {
    for (const conflict of conflictsForDiet(diet, settings)) {
      const id = `${conflict.field}|${conflict.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(conflict);
    }
  }
  return out;
}
