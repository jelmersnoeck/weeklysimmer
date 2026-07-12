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
});

export const rawMealSchema = z.object({
  day: z.number().int().min(0).max(6),
  slot: slotSchema,
  title: z.string().min(1),
  cuisine: z.string(),
  proteinClass: proteinClassSchema,
  base: z.string(),
  difficulty: difficultySchema,
  ingredients: z.array(ingredientSchema).min(1),
  steps: z.array(z.string()),
  sourceUrl: z.string().optional(),
  leftoverOf: z
    .object({ day: z.number().int().min(0).max(6), slot: slotSchema })
    .nullable()
    .optional(),
});

export const planSchema = z.object({ meals: z.array(rawMealSchema).min(1) });

export type RawMeal = z.infer<typeof rawMealSchema>;
export type RawPlan = z.infer<typeof planSchema>;
