import type { Settings, Meal, Slot } from "../domain/types.js";

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export interface CurationPromptInput {
  settings: Settings;
  weekStart: string;
  vegBox: string[];
  note: string;
  avoid: string[];
}

/**
 * Build the (pure, no-network) curation prompt handed to the LLM.
 *
 * All tunable wording lives here on purpose so the meal-planning behaviour can be
 * adjusted in one place. The LLM ONLY returns structured recipe data; deterministic
 * code scales portions and builds the shopping list afterwards.
 */
export function buildCurationPrompt(input: CurationPromptInput): string {
  const { settings, weekStart, vegBox, note, avoid } = input;

  const vegList = vegBox.length > 0 ? vegBox.join(", ") : "(none this week)";
  const restrictions =
    settings.restrictions.length > 0 ? settings.restrictions.join(", ") : "(none)";
  const avoidIngredients =
    settings.avoidIngredients.length > 0 ? settings.avoidIngredients.join(", ") : "(none)";
  const avoidRepeat = avoid.length > 0 ? avoid.map((m) => `- ${m}`).join("\n") : "- (nothing yet)";
  const vegPerWeek = settings.proteinCadence.veg_per_week;
  const redPerWeek = settings.proteinCadence.red_or_high_fat_per_week;

  return `You are a meal-prep planner for a family household. Plan one week of meals.
Week starting (Monday): ${weekStart}
User note for this week: ${note}

You are ONLY responsible for choosing REAL recipes and returning them as structured
data. The application scales portions and builds the shopping list itself, so you do
not need to do any arithmetic on quantities.

## Veg box — build the week AROUND it
This week's veg box contains: ${vegList}.
Build the whole week around USING UP the veg box first. Every veg-box item should be
used in at least one meal so nothing goes to waste. Minimize food waste — prefer
recipes that consume these vegetables before adding new produce.

## Hard restrictions (STRICT — always EXCLUDE)
Dietary restrictions to strictly exclude: ${restrictions}.
- no_spicy: no chilli, hot peppers, or spicy heat.
- low_fodmap: keep meals low-FODMAP.
Ingredients to EXCLUDE entirely (never use these): ${avoidIngredients}.

## Protein cadence (across the week)
- About ${vegPerWeek} vegetarian meal per week.
- About ${redPerWeek} red or high-fat-meat meal per week.
- The REST of the meals should be lean, high-protein: chicken, tuna, fish, turkey, eggs.
Classify each meal's proteinClass as exactly one of: "lean", "red_or_high_fat", "vegetarian".

## Effort
Dinners must be "easy" ~30-minute weeknight dinners. Keep steps short and simple.

## Leftovers & shared-base strategy
- Dinners are the real cooked meals of the day.
- Lunches should reuse dinner leftovers or a shared base (rice / chicken / tuna served
  in a different format) so cooking effort stays low.
- When a lunch reuses a specific dinner, set that lunch's "leftoverOf" to the dinner it
  reuses: { "day": <0-6>, "slot": "dinner" }. Otherwise set "leftoverOf" to null.
- Breakfasts rotate a small, simple set (they can repeat across the week).

## Do NOT repeat these recent meals
${avoidRepeat}
Do not repeat any meal listed above.

## Output requirements
- Produce a FULL week: 7 days (day 0 = Monday through day 6 = Sunday) x 3 slots
  (breakfast, lunch, dinner) = 21 meals total.
- Use the web search tool to find REAL recipes, and return a "sourceUrl" for each meal
  where possible (the URL of the recipe you based it on).
- Ingredient quantities are PER SINGLE SERVING (the app scales them for the household).
  Use sensible units: g, ml, piece, clove, tbsp.
- Give every ingredient a shopping "category" (one of: produce, meat, fish, dairy,
  grains, pantry, ...).

Return the plan as structured data matching the required schema.`;
}

export interface RegeneratePromptInput {
  settings: Settings;
  day: number;
  slot: Slot;
  vegBox: string[];
  note: string;
  otherMeals: Meal[];
}

/**
 * Build the (pure, no-network) prompt to regenerate ONE meal in an existing week.
 *
 * The same standing household constraints apply (no spicy, low-FODMAP, lean-protein
 * cadence, easy ~30-minute dinners), but the model returns a SINGLE replacement meal
 * that must be meaningfully different from the other meals already in the plan.
 */
export function buildRegeneratePrompt(input: RegeneratePromptInput): string {
  const { settings, day, slot, vegBox, note, otherMeals } = input;

  const dayName = DAY_NAMES[day] ?? `day ${day}`;
  const vegList = vegBox.length > 0 ? vegBox.join(", ") : "(none this week)";
  const restrictions =
    settings.restrictions.length > 0 ? settings.restrictions.join(", ") : "(none)";
  const avoidIngredients =
    settings.avoidIngredients.length > 0
      ? settings.avoidIngredients.join(", ")
      : "(none)";
  const otherTitles =
    otherMeals.length > 0
      ? otherMeals.map((m) => `- ${m.title}`).join("\n")
      : "- (none)";

  return `You are a meal-prep planner for a family household. Replace ONE meal in an
existing weekly plan and return it as a single structured meal.

## Target slot
Regenerate the meal for ${dayName} (day ${day}), slot: ${slot}.
User note for this week: ${note}

## Veg box — prefer using it up
This week's veg box contains: ${vegList}. Prefer a recipe that helps use up these
vegetables so nothing goes to waste.

## Hard restrictions (STRICT — always EXCLUDE)
Dietary restrictions to strictly exclude: ${restrictions}.
- no_spicy: no chilli, hot peppers, or spicy heat.
- low_fodmap: keep the meal low-FODMAP.
Ingredients to EXCLUDE entirely (never use these): ${avoidIngredients}.

## Protein & effort
- Favour lean, high-protein choices (chicken, tuna, fish, turkey, eggs) unless this
  slot is meant to be vegetarian or a red/high-fat-meat meal.
- Keep it easy: an ~30-minute weeknight dinner with short, simple steps.

## Variety — be DIFFERENT
The plan already contains these meals; the replacement MUST be different from them,
using a different main dish for variety (different protein, cuisine, or base):
${otherTitles}

## Output requirements
- Return exactly ONE meal for day ${day}, slot ${slot}, matching the required schema.
- Use the web search tool to find a REAL recipe, returning a "sourceUrl" where possible.
- Ingredient quantities are PER SINGLE SERVING (the app scales them for the household).
  Use sensible units (g, ml, piece, clove, tbsp) and a shopping "category" per ingredient
  (produce, meat, fish, dairy, grains, pantry, ...).

Return the single meal as structured data matching the required schema.`;
}
