export type Slot = "breakfast" | "lunch" | "dinner";
export type Difficulty = "easy" | "medium" | "hard";
export type ProteinClass = "lean" | "red_or_high_fat" | "vegetarian";

export interface Ingredient {
  name: string;
  quantity: number;   // per single recipe serving (normalized)
  unit: string;       // "g" | "ml" | "clove" | "piece" | "tbsp" | ...
  category: string;   // shopping aisle: "produce" | "meat" | "dairy" | ...
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
  servings?: number;  // whole servings the meal's ingredients are scaled to
  ingredients: Ingredient[];
  steps: string[];
  sourceUrl?: string;
  leftoverOf?: { day: number; slot: Slot } | null;
  rating?: number | null; // 1-5
}

export interface HouseholdMember { label: string; consumptionFactor: number; }

export interface Settings {
  members: HouseholdMember[];
  restrictions: string[];       // ["no_spicy","low_fodmap"]
  avoidIngredients: string[];   // ["beans","lentils",...]
  proteinCadence: { veg_per_week: number; red_or_high_fat_per_week: number };
  effort: Difficulty;
  defaultVegQuantities: Record<string, { quantity: number; unit: string }>;
}

export interface WeeklyPlan {
  id?: number;
  weekStart: string;  // ISO date (Monday)
  vegBox: string[];   // vegetable type names
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
}
