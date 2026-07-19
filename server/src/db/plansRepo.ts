import type Database from "better-sqlite3";
import type {
  WeeklyPlan,
  Meal,
  ShoppingItem,
  Slot,
} from "../domain/types.js";

const SLOT_ORDER: Record<Slot, number> = {
  breakfast: 0,
  morning_snack: 1,
  lunch: 2,
  afternoon_snack: 3,
  dinner: 4,
};

interface PlanRow {
  id: number;
  week_start: string;
  on_hand: string;
  note: string;
  status: WeeklyPlan["status"];
  created_at: string;
}

interface MealRow {
  id: number;
  day: number;
  slot: Slot;
  title: string;
  cuisine: string;
  protein_class: Meal["proteinClass"];
  base: string;
  difficulty: Meal["difficulty"];
  prep_minutes: number | null;
  cook_minutes: number | null;
  calories_per_serving: number | null;
  servings: number;
  ingredients: string;
  steps: string;
  source_url: string | null;
  leftover_of: string | null;
  rating: number | null;
}

interface ShoppingItemRow {
  name: string;
  total_quantity: number;
  unit: string;
  category: string;
  checked: number;
}

export interface PlanSummary {
  id: number;
  weekStart: string;
  note: string;
  status: WeeklyPlan["status"];
  createdAt: string;
}

export function savePlan(db: Database.Database, plan: WeeklyPlan): number {
  const insertPlan = db.prepare(
    "INSERT INTO weekly_plans (week_start, on_hand, note, status) VALUES (?, ?, ?, ?)"
  );
  const insertMeal = db.prepare(
    `INSERT INTO meals
      (plan_id, day, slot, title, cuisine, protein_class, base, difficulty,
       prep_minutes, cook_minutes, calories_per_serving, servings, ingredients,
       steps, source_url, leftover_of, rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction((p: WeeklyPlan): number => {
    const result = insertPlan.run(
      p.weekStart,
      JSON.stringify(p.onHand),
      p.note,
      p.status
    );
    const planId = Number(result.lastInsertRowid);
    for (const meal of p.meals) {
      insertMeal.run(
        planId,
        meal.day,
        meal.slot,
        meal.title,
        meal.cuisine,
        meal.proteinClass,
        meal.base,
        meal.difficulty,
        meal.prepMinutes ?? null,
        meal.cookMinutes ?? null,
        meal.caloriesPerServing ?? null,
        meal.servings ?? 1,
        JSON.stringify(meal.ingredients),
        JSON.stringify(meal.steps),
        meal.sourceUrl ?? null,
        meal.leftoverOf ? JSON.stringify(meal.leftoverOf) : null,
        meal.rating ?? null
      );
    }
    return planId;
  });

  return tx(plan);
}

export function getPlan(db: Database.Database, id: number): WeeklyPlan | null {
  const planRow = db
    .prepare("SELECT * FROM weekly_plans WHERE id = ?")
    .get(id) as PlanRow | undefined;
  if (!planRow) return null;

  const mealRows = db
    .prepare("SELECT * FROM meals WHERE plan_id = ?")
    .all(id) as MealRow[];

  const meals: Meal[] = mealRows
    .map(rowToMeal)
    .sort((a, b) =>
      a.day !== b.day
        ? a.day - b.day
        : SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]
    );

  return {
    id: planRow.id,
    weekStart: planRow.week_start,
    onHand: JSON.parse(planRow.on_hand) as string[],
    note: planRow.note,
    status: planRow.status,
    meals,
  };
}

export function listPlans(db: Database.Database): PlanSummary[] {
  const rows = db
    .prepare(
      "SELECT id, week_start, note, status, created_at FROM weekly_plans ORDER BY id DESC"
    )
    .all() as Pick<
    PlanRow,
    "id" | "week_start" | "note" | "status" | "created_at"
  >[];

  return rows.map((r) => ({
    id: r.id,
    weekStart: r.week_start,
    note: r.note,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/** Returns the number of rows changed (0 when no meal has that id). */
export function rateMeal(
  db: Database.Database,
  mealId: number,
  rating: number
): number {
  const info = db
    .prepare("UPDATE meals SET rating = ? WHERE id = ?")
    .run(rating, mealId);
  return info.changes;
}

/**
 * Overwrite the CONTENT columns of a single meal in place, keeping its identity
 * (id, plan_id, day, slot). Resets the rating to null since the meal changed.
 * Used by the regenerate flow to swap one meal without disturbing the rest of the plan.
 */
export function updateMeal(
  db: Database.Database,
  mealId: number,
  meal: Meal
): void {
  db.prepare(
    `UPDATE meals SET
       title = ?, cuisine = ?, protein_class = ?, base = ?, difficulty = ?,
       prep_minutes = ?, cook_minutes = ?, calories_per_serving = ?, servings = ?,
       ingredients = ?, steps = ?, source_url = ?, leftover_of = ?, rating = NULL
     WHERE id = ?`
  ).run(
    meal.title,
    meal.cuisine,
    meal.proteinClass,
    meal.base,
    meal.difficulty,
    meal.prepMinutes ?? null,
    meal.cookMinutes ?? null,
    meal.caloriesPerServing ?? null,
    meal.servings ?? 1,
    JSON.stringify(meal.ingredients),
    JSON.stringify(meal.steps),
    meal.sourceUrl ?? null,
    meal.leftoverOf ? JSON.stringify(meal.leftoverOf) : null,
    mealId
  );
}

export function saveShoppingItems(
  db: Database.Database,
  planId: number,
  items: ShoppingItem[]
): void {
  const del = db.prepare("DELETE FROM shopping_items WHERE plan_id = ?");
  const insert = db.prepare(
    `INSERT INTO shopping_items
      (plan_id, name, total_quantity, unit, category, checked)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction((pid: number, list: ShoppingItem[]): void => {
    del.run(pid);
    for (const item of list) {
      insert.run(
        pid,
        item.name,
        item.totalQuantity,
        item.unit,
        item.category,
        item.checked ? 1 : 0
      );
    }
  });

  tx(planId, items);
}

export function getShoppingItems(
  db: Database.Database,
  planId: number
): ShoppingItem[] {
  const rows = db
    .prepare(
      "SELECT name, total_quantity, unit, category, checked FROM shopping_items WHERE plan_id = ? ORDER BY id ASC"
    )
    .all(planId) as ShoppingItemRow[];

  return rows.map((r) => ({
    name: r.name,
    totalQuantity: r.total_quantity,
    unit: r.unit,
    category: r.category,
    checked: r.checked === 1,
  }));
}

/** Insert one meal into an existing plan and return its new id. */
export function addMeal(
  db: Database.Database,
  planId: number,
  meal: Meal
): number {
  const info = db
    .prepare(
      `INSERT INTO meals
        (plan_id, day, slot, title, cuisine, protein_class, base, difficulty,
         prep_minutes, cook_minutes, calories_per_serving, servings, ingredients,
         steps, source_url, leftover_of, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      planId,
      meal.day,
      meal.slot,
      meal.title,
      meal.cuisine,
      meal.proteinClass,
      meal.base,
      meal.difficulty,
      meal.prepMinutes ?? null,
      meal.cookMinutes ?? null,
      meal.caloriesPerServing ?? null,
      meal.servings ?? 1,
      JSON.stringify(meal.ingredients),
      JSON.stringify(meal.steps),
      meal.sourceUrl ?? null,
      meal.leftoverOf ? JSON.stringify(meal.leftoverOf) : null,
      meal.rating ?? null
    );
  return Number(info.lastInsertRowid);
}

/** Remove a single meal by id (used when an adjustment clears a slot). */
export function deleteMeal(db: Database.Database, mealId: number): void {
  db.prepare("DELETE FROM meals WHERE id = ?").run(mealId);
}

/** A saved pre-adjustment snapshot of a plan (its meals + shopping list). */
export interface PlanSnapshot {
  id: number;
  note: string;
  cutoffDay: number;
  cutoffSlot: Slot;
  createdAt: string;
  meals: Meal[];
  shopping: ShoppingItem[];
}

interface SnapshotRow {
  id: number;
  note: string;
  cutoff_day: number;
  cutoff_slot: Slot;
  plan_json: string;
  shopping_json: string;
  created_at: string;
}

/** Record the plan's current meals + shopping before an adjustment overwrites them. */
export function saveSnapshot(
  db: Database.Database,
  planId: number,
  snapshot: {
    note: string;
    cutoffDay: number;
    cutoffSlot: Slot;
    meals: Meal[];
    shopping: ShoppingItem[];
  }
): number {
  const info = db
    .prepare(
      `INSERT INTO plan_snapshots
        (plan_id, note, cutoff_day, cutoff_slot, plan_json, shopping_json)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      planId,
      snapshot.note,
      snapshot.cutoffDay,
      snapshot.cutoffSlot,
      JSON.stringify(snapshot.meals),
      JSON.stringify(snapshot.shopping)
    );
  return Number(info.lastInsertRowid);
}

/** All snapshots for a plan, newest first. */
export function listSnapshots(
  db: Database.Database,
  planId: number
): PlanSnapshot[] {
  const rows = db
    .prepare(
      "SELECT id, note, cutoff_day, cutoff_slot, plan_json, shopping_json, created_at FROM plan_snapshots WHERE plan_id = ? ORDER BY id DESC"
    )
    .all(planId) as SnapshotRow[];

  return rows.map((r) => ({
    id: r.id,
    note: r.note,
    cutoffDay: r.cutoff_day,
    cutoffSlot: r.cutoff_slot,
    createdAt: r.created_at,
    meals: JSON.parse(r.plan_json) as Meal[],
    shopping: JSON.parse(r.shopping_json) as ShoppingItem[],
  }));
}

function rowToMeal(row: MealRow): Meal {
  return {
    id: row.id,
    day: row.day,
    slot: row.slot,
    title: row.title,
    cuisine: row.cuisine,
    proteinClass: row.protein_class,
    base: row.base,
    difficulty: row.difficulty,
    prepMinutes: row.prep_minutes ?? undefined,
    cookMinutes: row.cook_minutes ?? undefined,
    caloriesPerServing: row.calories_per_serving ?? undefined,
    servings: row.servings,
    ingredients: JSON.parse(row.ingredients),
    steps: JSON.parse(row.steps),
    sourceUrl: row.source_url ?? undefined,
    leftoverOf: row.leftover_of ? JSON.parse(row.leftover_of) : null,
    rating: row.rating,
  };
}
