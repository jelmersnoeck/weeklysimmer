import { z } from "zod";

export const slotSchema = z.enum([
  "breakfast",
  "morning_snack",
  "lunch",
  "afternoon_snack",
  "dinner",
]);
export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export const proteinClassSchema = z.enum(["lean", "red_or_high_fat", "vegetarian"]);

export const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1),
  category: z.string().min(1),
  // Optional cup/spoon measure (metric quantity+unit stays the canonical measure).
  cupQuantity: z.number().nonnegative().optional(),
  cupUnit: z.string().optional(),
});

export const rawMealSchema = z.object({
  day: z.number().int().min(0).max(6),
  slot: slotSchema,
  title: z.string().min(1),
  cuisine: z.string(),
  proteinClass: proteinClassSchema,
  base: z.string(),
  difficulty: difficultySchema,
  prepMinutes: z.number().int().min(0),
  cookMinutes: z.number().int().min(0),
  caloriesPerServing: z.number().int().min(0),
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(z.string()),
  sourceUrl: z.string().optional(),
  leftoverOf: z
    .object({ day: z.number().int().min(0).max(6), slot: slotSchema })
    .nullable()
    .optional(),
});

export const planSchema = z.object({ meals: z.array(rawMealSchema).min(1) });

/**
 * A mid-week adjustment result: the LLM returns ONLY the cells it wants to change
 * (`changes`, full replacement meals) plus cells to clear entirely (`removals`).
 * Everything else in the week is left untouched. Both arrays may be empty.
 */
export const adjustResultSchema = z.object({
  changes: z.array(rawMealSchema),
  removals: z.array(
    z.object({ day: z.number().int().min(0).max(6), slot: slotSchema }),
  ),
});

/**
 * Shopping-list consolidation review: for EACH input item name the LLM returns a
 * `canonical` grocery-product name. Same-product items share a canonical (so code
 * can re-merge them); genuinely different products keep distinct canonicals.
 */
export const consolidationSchema = z.object({
  items: z.array(z.object({ name: z.string(), canonical: z.string() })),
});

export type RawMeal = z.infer<typeof rawMealSchema>;
export type RawPlan = z.infer<typeof planSchema>;
export type AdjustResult = z.infer<typeof adjustResultSchema>;
export type Consolidation = z.infer<typeof consolidationSchema>;
