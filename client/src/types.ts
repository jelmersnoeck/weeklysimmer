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
  cupQuantity?: number;
  cupUnit?: string;
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
  cupQuantity?: number;
  cupUnit?: string;
}

// --- Settings v2 — household food preferences. ---

export type Frequency = "never" | "occasionally" | "weekly" | "often";
export type Appetite = "light" | "standard" | "hearty" | "very_active";
export type MemberType = "adult" | "child" | "toddler" | "baby";
export type Diet = "vegetarian" | "vegan" | "pescatarian" | "low_fodmap";

// Which measurement systems to show quantities in. At least one is always set.
export type MeasurementSystem = "metric" | "cups";

export interface HouseholdMember {
  id: string;
  name?: string;
  type: MemberType;
  appetite: Appetite;
}

export interface ProteinPref {
  key: string;
  frequency: Frequency;
}

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
  units: MeasurementSystem[];
  effort: "easy" | "medium" | "hard";
  /** Free-text standing instructions applied to every plan; "" when unset. */
  personalNote: string;
  // Which meals to plan per slot; NOT edited on the settings screen — carried through as-is.
  mealSchedule: MealSchedule;
}

// Canonical option lists the preferences UI renders from (GET /api/options).
export interface Options {
  proteins: string[];
  cuisines: string[];
  dishTypes: string[];
  flavours: string[];
  avoids: string[];
  diets: string[];
  measurementSystems: MeasurementSystem[];
  vegetables: string[];
  fruits: string[];
  frequencies: string[];
  appetites: string[];
  memberTypes: string[];
  appetiteFactor: Record<MemberType, Record<Appetite, number>>;
}

// A non-blocking warning that a selection clashes with the chosen diet.
export interface DietConflict {
  field: "proteins" | "flavours" | "dishTypes";
  key: string;
  message: string;
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

// The two-sided shopping diff a mid-week adjustment produces.
export interface ShoppingDelta {
  toBuy: ShoppingItem[];
  leftover: ShoppingItem[];
}

// A background plan-generation OR adjustment job (GET /api/jobs, GET /api/jobs/:id).
export interface Job {
  id: string;
  status: JobStatus;
  planId: number | null;
  error: string | null;
  weekStart: string;
  createdAt: string;
  // Present on a completed adjustment job: what changed on the shopping list.
  result?: ShoppingDelta | null;
}

// Which meals an adjustment may change. `from` = a time-based cut-off (everything at or
// after the (day, slot) cell); `days` = only the listed day indices (0=Mon..6=Sun).
export type AdjustScope =
  | { kind: "from"; day: number; slot: Slot }
  | { kind: "days"; days: number[] };

// Body for POST /api/plans/:id/adjust — a directional note + the scope to change.
export interface AdjustInput {
  note: string;
  scope: AdjustScope;
}

// A saved pre-adjustment snapshot (GET /api/plans/:id/snapshots).
export interface PlanSnapshot {
  id: number;
  note: string;
  scope: AdjustScope;
  createdAt: string;
  meals: Meal[];
  shopping: ShoppingItem[];
}
