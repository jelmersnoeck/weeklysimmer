// Shared domain types — mirror the backend API contract.

export type ProteinClass = "lean" | "red_or_high_fat" | "vegetarian";
export type Slot =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "afternoon_snack"
  | "dinner";
export type Difficulty = "easy" | "medium" | "hard";
export type PlanStatus = "draft" | "active" | "archived";

// Which meals to plan, per slot, across the 7 days of the week.
// Each slot maps to 7 booleans (index 0 = Mon .. 6 = Sun).
export type MealSchedule = Record<Slot, boolean[]>;

// A single enabled meal in the week: which day, which slot.
export type EnabledSlot = { day: number; slot: Slot };

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
  prepMinutes?: number;
  cookMinutes?: number;
  caloriesPerServing?: number; // kcal for one person's serving; absent on older meals.
  ingredients: Ingredient[];
  steps: string[];
  sourceUrl?: string;
  leftoverOf?: { day: number; slot: Slot } | null;
  rating?: number | null;
}

export interface WeeklyPlan {
  id: number;
  weekStart: string;
  onHand: string[];
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
  mealSchedule: MealSchedule;
}

// A full plan payload as returned by GET /api/plans/:id and generate.
export interface PlanBundle {
  plan: WeeklyPlan;
  shopping: ShoppingItem[];
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
  onHand: string[];
  note: string;
  avoid: string[];
  enabledSlots: EnabledSlot[];
}

// POST /api/plans/generate now runs generation in the background and returns
// a job handle (202) rather than the finished plan.
export interface GeneratePlanResult {
  jobId: string;
}

export type JobStatus = "running" | "done" | "error";

// A background plan-generation job (GET /api/jobs, GET /api/jobs/:id).
export interface Job {
  id: string;
  status: JobStatus;
  planId: number | null;
  error: string | null;
  weekStart: string;
  createdAt: string;
}
