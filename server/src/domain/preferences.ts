import type {
  Appetite,
  Frequency,
  HouseholdMember,
  MemberType,
  ProteinPref,
  Settings,
} from "./types.js";
import { defaultMealSchedule } from "./schedule.js";

/**
 * Canonical option lists for the preferences UI and validation. These strings are
 * the single source of truth — the same keys travel through settings, the options
 * endpoint, diet-conflict rules and the LLM prompt.
 */
export const PROTEINS = [
  "chicken",
  "turkey",
  "beef",
  "pork",
  "lamb",
  "white_fish",
  "salmon",
  "tuna",
  "shellfish",
  "eggs",
  "tofu",
  "beans_legumes",
  "halloumi_paneer",
] as const;

export const FREQUENCIES: readonly Frequency[] = [
  "never",
  "occasionally",
  "weekly",
  "often",
];

export const APPETITES: readonly Appetite[] = [
  "light",
  "standard",
  "hearty",
  "very_active",
];

export const MEMBER_TYPES: readonly MemberType[] = ["adult", "child", "toddler", "baby"];

export const CUISINES = [
  "italian",
  "mediterranean",
  "asian",
  "thai",
  "indian",
  "chinese",
  "japanese",
  "mexican",
  "french",
  "middle_eastern",
  "american",
  "british",
] as const;

export const DISH_TYPES = [
  "bakes",
  "burgers",
  "pasta",
  "soup",
  "stir_fry",
  "salad",
  "curry",
  "roast",
  "grain_bowl",
  "tray_bake",
  "wraps_tacos",
] as const;

export const FLAVOURS = [
  "sweet",
  "savoury",
  "tangy",
  "spicy",
  "cheesy",
  "smoky",
  "herby",
  "garlicky",
  "creamy",
  "umami",
] as const;

export const AVOIDS = [
  "dairy",
  "gluten",
  "spicy",
  "shellfish",
  "fish",
  "peanuts",
  "tree_nuts",
  "eggs",
  "soy",
  "beef",
  "pork",
  "sesame",
] as const;

export const DIETS = [
  "none",
  "vegetarian",
  "vegan",
  "pescatarian",
  "low_fodmap",
  "gluten_free",
  "dairy_free",
  "lactose_free",
] as const;

export const VEGETABLES = [
  "carrot",
  "broccoli",
  "spinach",
  "courgette",
  "bell_pepper",
  "tomato",
  "leek",
  "mushroom",
  "cauliflower",
  "green_beans",
  "peas",
  "sweet_potato",
  "potato",
  "aubergine",
  "kale",
  "cabbage",
] as const;

export const FRUITS = [
  "apple",
  "banana",
  "berries",
  "citrus",
  "grapes",
  "mango",
  "pear",
  "pineapple",
] as const;

/** Portion factor per household member, in adult-standard-equivalents. */
export const APPETITE_FACTOR: Record<MemberType, Record<Appetite, number>> = {
  adult: { light: 0.9, standard: 1.0, hearty: 1.2, very_active: 1.4 },
  child: { light: 0.4, standard: 0.5, hearty: 0.7, very_active: 0.9 },
  toddler: { light: 0.25, standard: 0.35, hearty: 0.5, very_active: 0.6 },
  baby: { light: 0.1, standard: 0.15, hearty: 0.2, very_active: 0.25 },
};

/** The portion factor a single member contributes to the household serving count. */
export function memberFactor(m: HouseholdMember): number {
  return APPETITE_FACTOR[m.type][m.appetite];
}

/** The prefilled protein frequencies used by the default (unconfigured) profile. */
const DEFAULT_PROTEIN_FREQUENCY: Record<string, Frequency> = {
  chicken: "often",
  turkey: "occasionally",
  beef: "occasionally",
  pork: "never",
  lamb: "never",
  white_fish: "weekly",
  salmon: "weekly",
  tuna: "weekly",
  shellfish: "never",
  eggs: "weekly",
  tofu: "occasionally",
  beans_legumes: "never",
  halloumi_paneer: "never",
};

/**
 * A sensible starter profile. Synthesized (not persisted) whenever no valid v2
 * settings row exists, so the UI has something to show — but `configured` is false
 * so plan generation is blocked until the user saves their own preferences.
 */
export function defaultSettings(): Settings {
  const proteins: ProteinPref[] = PROTEINS.map((key) => ({
    key,
    frequency: DEFAULT_PROTEIN_FREQUENCY[key] ?? "never",
  }));

  return {
    configured: false,
    household: [
      { id: "a1", type: "adult", appetite: "hearty" },
      { id: "a2", type: "adult", appetite: "hearty" },
      { id: "c1", type: "toddler", appetite: "standard" },
    ],
    proteins,
    vegetablesLiked: [
      "carrot",
      "broccoli",
      "spinach",
      "courgette",
      "bell_pepper",
      "tomato",
      "leek",
      "green_beans",
    ],
    fruitsLiked: ["apple", "banana", "berries", "citrus"],
    cuisinesLiked: ["mediterranean", "asian", "italian", "thai", "japanese", "british"],
    dishTypesLiked: ["stir_fry", "bakes", "grain_bowl", "soup", "roast", "tray_bake", "salad"],
    flavoursLiked: ["savoury", "herby", "umami", "creamy"],
    avoid: ["spicy"],
    diet: "low_fodmap",
    effort: "easy",
    mealSchedule: defaultMealSchedule(),
  };
}
