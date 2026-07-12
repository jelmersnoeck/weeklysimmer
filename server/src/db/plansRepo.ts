import type Database from "better-sqlite3";
import type {
  WeeklyPlan,
  Meal,
  ShoppingItem,
  Slot,
} from "../domain/types.js";

const SLOT_ORDER: Record<Slot, number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
};

interface PlanRow {
  id: number;
  week_start: string;
  veg_box: string;
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
    "INSERT INTO weekly_plans (week_start, veg_box, note, status) VALUES (?, ?, ?, ?)"
  );
  const insertMeal = db.prepare(
    `INSERT INTO meals
      (plan_id, day, slot, title, cuisine, protein_class, base, difficulty,
       servings, ingredients, steps, source_url, leftover_of, rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const tx = db.transaction((p: WeeklyPlan): number => {
    const result = insertPlan.run(
      p.weekStart,
      JSON.stringify(p.vegBox),
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
    vegBox: JSON.parse(planRow.veg_box) as string[],
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

export function rateMeal(
  db: Database.Database,
  mealId: number,
  rating: number
): void {
  db.prepare("UPDATE meals SET rating = ? WHERE id = ?").run(rating, mealId);
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
       servings = ?, ingredients = ?, steps = ?, source_url = ?, leftover_of = ?, rating = NULL
     WHERE id = ?`
  ).run(
    meal.title,
    meal.cuisine,
    meal.proteinClass,
    meal.base,
    meal.difficulty,
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
    servings: row.servings,
    ingredients: JSON.parse(row.ingredients),
    steps: JSON.parse(row.steps),
    sourceUrl: row.source_url ?? undefined,
    leftoverOf: row.leftover_of ? JSON.parse(row.leftover_of) : null,
    rating: row.rating,
  };
}
