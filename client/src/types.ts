// Shared domain types — mirror the backend API contract.

export type ProteinClass = "lean" | "red_or_high_fat" | "vegetarian";
export type Slot = "breakfast" | "lunch" | "dinner";
export type Difficulty = "easy" | "medium" | "hard";
export type PlanStatus = "draft" | "active" | "archived";

export interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
  category: string;
}

export interface Meal {
  id: number;
  day: number; // 0 = Mon .. 6 = Sun
  slot: Slot;
  title: string;
  cuisine: string;
  proteinClass: ProteinClass;
  base: string;
  difficulty: Difficulty;
  ingredients: Ingredient[];
  steps: string[];
  sourceUrl?: string;
  leftoverOf?: { day: number; slot: Slot } | null;
  rating?: number | null;
}

export interface WeeklyPlan {
  id: number;
  weekStart: string;
  vegBox: string[];
  note: string;
  status: PlanStatus;
  meals: Meal[];
}

export interface ShoppingItem {
  name: string;
  totalQuantity: number;
  unit: string;
  category: string;
  checked: boolean;
}

export interface Member {
  label: string;
  consumptionFactor: number;
}

export interface Settings {
  members: Member[];
  restrictions: string[];
  avoidIngredients: string[];
  proteinCadence: {
    veg_per_week: number;
    red_or_high_fat_per_week: number;
  };
  effort: string;
  defaultVegQuantities: Record<string, unknown>;
}

// A full plan payload as returned by GET /api/plans/:id and generate.
export interface PlanBundle {
  plan: WeeklyPlan;
  shopping: ShoppingItem[];
  unusedVeg: string[];
}

// Row in the plans list (GET /api/plans).
export interface PlanSummary {
  id: number;
  weekStart: string;
  note: string;
  status: PlanStatus;
  createdAt: string;
  // Optional: the backend may include an average rating for the week.
  avgRating?: number | null;
}

export interface GeneratePlanInput {
  weekStart: string;
  vegBox: string[];
  note: string;
  avoid: string[];
}

export interface GeneratePlanResult extends PlanBundle {
  planId: number;
}
