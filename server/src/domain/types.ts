export type Slot =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "afternoon_snack"
  | "dinner";
export type Difficulty = "easy" | "medium" | "hard";
export type ProteinClass = "lean" | "red_or_high_fat" | "vegetarian";

/** Which day/slot cells the user wants meals for: each slot maps to 7 booleans (Mon…Sun). */
export type MealSchedule = Record<Slot, boolean[]>;

/** A single enabled day/slot cell the planner should generate a meal for. */
export interface EnabledSlot {
  day: number; // 0=Mon .. 6=Sun
  slot: Slot;
}

export interface Ingredient {
  name: string;
  quantity: number;   // per single recipe serving (normalized)
  unit: string;       // "g" | "ml" | "clove" | "piece" | "tbsp" | ...
  category: string;   // shopping aisle: "produce" | "meat" | "dairy" | ...
  cupQuantity?: number; // optional per-serving cup/spoon amount (metric stays canonical)
  cupUnit?: string;     // "cup" | "tbsp" | "tsp"
}

export interface Meal {
  id?: number;
  day: number;        // 0=Mon .. 6=Sun
  slot: Slot;
  title: string;
  cuisine: string;
  proteinClass: ProteinClass;
  base: string;       // "rice" | "pasta" | "potato" | "none" | ...
  difficulty: Difficulty;
  prepMinutes?: number;  // hands-on prep time in minutes
  cookMinutes?: number;  // cooking time in minutes (0 for no-cook meals)
  caloriesPerServing?: number;  // estimated kcal for a single person's serving
  servings?: number;  // whole servings the meal's ingredients are scaled to
  ingredients: Ingredient[];
  steps: string[];
  sourceUrl?: string;
  leftoverOf?: { day: number; slot: Slot } | null;
  rating?: number | null; // 1-5
}

export type Frequency = "never" | "occasionally" | "weekly" | "often";
export type Appetite = "light" | "standard" | "hearty" | "very_active";
export type MemberType = "adult" | "child" | "toddler" | "baby";
export type Diet = "vegetarian" | "vegan" | "pescatarian" | "low_fodmap";
/** How the household prefers to see quantities. Metric is always the canonical measure. */
export type MeasurementSystem = "metric" | "cups";

/** One person in the household. Appetite + type drive the portion factor. */
export interface HouseholdMember {
  id: string;
  name?: string;
  type: MemberType;
  appetite: Appetite;
}

/** A protein and how often the household wants it. `never` excludes it. */
export interface ProteinPref {
  key: string;
  frequency: Frequency;
}

/**
 * Configurable household preferences ("Settings v2"). `configured` gates plan
 * generation: a freshly-synthesized default profile is `configured: false` until
 * the user saves their own via PUT /api/settings.
 */
export interface Settings {
  configured: boolean;
  household: HouseholdMember[];
  proteins: ProteinPref[];
  vegetablesLiked: string[];
  fruitsLiked: string[];
  cuisinesLiked: string[];
  dishTypesLiked: string[];
  flavoursLiked: string[];
  avoid: string[];
  diets: Diet[];
  units: MeasurementSystem[]; // at least one; "metric" is always the canonical measure
  effort: Difficulty;
  mealSchedule: MealSchedule;
}

export interface WeeklyPlan {
  id?: number;
  weekStart: string;  // ISO date (Monday)
  onHand: string[];   // foods the household already has and wants to use up
  note: string;
  status: "draft" | "active" | "archived";
  meals: Meal[];
}

export interface ShoppingItem {
  name: string;
  totalQuantity: number;
  unit: string;
  category: string;
  checked: boolean;
  cupQuantity?: number; // summed cup/spoon amount across the merged entries (when present)
  cupUnit?: string;     // "cup" | "tbsp" | "tsp"
}
