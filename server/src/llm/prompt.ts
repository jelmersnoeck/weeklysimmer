import type {
  Settings,
  Meal,
  Slot,
  ProteinClass,
  EnabledSlot,
} from "../domain/types.js";
import { SLOTS } from "../domain/schedule.js";

const PROTEIN_CLASS_WORDS: Record<ProteinClass, string> = {
  lean: "lean protein",
  red_or_high_fat: "red or higher-fat meat",
  vegetarian: "vegetarian",
};

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
  onHand: string[];
  note: string;
  avoid: string[];
  enabledSlots: EnabledSlot[];
}

/**
 * Render the enabled (day, slot) cells as a readable per-day list, e.g.
 *   - Monday (day 0): breakfast, lunch, dinner
 * Days with no enabled slots are omitted entirely.
 */
function formatEnabledSlots(enabledSlots: EnabledSlot[]): string {
  const lines: string[] = [];
  for (let day = 0; day < 7; day++) {
    const slots = SLOTS.filter((slot) =>
      enabledSlots.some((e) => e.day === day && e.slot === slot),
    );
    if (slots.length > 0) {
      const dayName = DAY_NAMES[day] ?? `day ${day}`;
      lines.push(`- ${dayName} (day ${day}): ${slots.join(", ")}`);
    }
  }
  return lines.join("\n");
}

/**
 * Build the (pure, no-network) curation prompt handed to the LLM.
 *
 * All tunable wording lives here on purpose so the meal-planning behaviour can be
 * adjusted in one place. The LLM ONLY returns structured recipe data; deterministic
 * code scales portions and builds the shopping list afterwards.
 */
export function buildCurationPrompt(input: CurationPromptInput): string {
  const { settings, weekStart, onHand, note, avoid, enabledSlots } = input;

  const enabledList = formatEnabledSlots(enabledSlots);
  const onHandList = onHand.length > 0 ? onHand.join(", ") : "(nothing this week)";
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

## Foods to use up — build the week AROUND them
These are foods the household already has and wants to use up: ${onHandList}.
Build the whole week around USING THESE UP first. Every item should be used in at
least one meal so nothing goes to waste. Minimize food waste — prefer recipes that
consume these foods before adding new ingredients.

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

## Effort & meal times
Dinners must be "easy" ~30-minute weeknight dinners (keep prepMinutes + cookMinutes
≲ 30). Keep steps short and simple.
Every meal MUST include realistic prep and cook time as integer minutes: "prepMinutes"
(hands-on prep) and "cookMinutes" (time actually cooking; use 0 for no-cook meals).
Every meal MUST also include "caloriesPerServing": the estimated kcal for a single
person's serving (the app scales portions, so this is per one serving, not the whole dish).

## Snacks (two per day: mid-morning and mid-afternoon)
- Each day has a "morning_snack" (mid-morning) and an "afternoon_snack" (mid-afternoon).
- Keep snacks simple and mostly no-cook or minimal prep — e.g. Greek yogurt, boiled
  eggs, cottage cheese, veg sticks, oatcakes, or fruit that fits low-FODMAP.
- Make them lean and high-protein where possible, and toddler-friendly.
- Snacks respect the same standing constraints (no spicy, low-FODMAP, avoid the
  avoid-list). Snacks typically have "cookMinutes": 0.

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

## Output requirements — generate EXACTLY these meals
Generate EXACTLY the following ${enabledSlots.length} meals (day 0 = Monday through
day 6 = Sunday) and NO others — do not add meals for any day/slot not listed here:
${enabledList}
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
  proteinClass: ProteinClass;
  onHand: string[];
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
  const { settings, day, slot, proteinClass, onHand, note, otherMeals } = input;

  const dayName = DAY_NAMES[day] ?? `day ${day}`;
  const proteinWords = PROTEIN_CLASS_WORDS[proteinClass];
  const onHandList = onHand.length > 0 ? onHand.join(", ") : "(nothing this week)";
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

## Foods to use up — prefer using them up
The household already has these foods to use up: ${onHandList}. Prefer a recipe that
helps use up these foods so nothing goes to waste.

## Hard restrictions (STRICT — always EXCLUDE)
Dietary restrictions to strictly exclude: ${restrictions}.
- no_spicy: no chilli, hot peppers, or spicy heat.
- low_fodmap: keep the meal low-FODMAP.
Ingredients to EXCLUDE entirely (never use these): ${avoidIngredients}.

## Protein class (STRICT — keep the week's balance)
This slot is a ${proteinWords} meal — the replacement MUST also be ${proteinWords} to
keep the week's protein balance. Do not switch it to a different protein class.

## Protein & effort
- Favour lean, high-protein choices (chicken, tuna, fish, turkey, eggs) unless this
  slot is meant to be vegetarian or a red/high-fat-meat meal.
- Keep it easy: an ~30-minute weeknight dinner with short, simple steps.
- If this slot is a snack (morning_snack or afternoon_snack), keep it simple and mostly
  no-cook or minimal prep (e.g. Greek yogurt, boiled eggs, cottage cheese, veg sticks,
  fruit) — lean, high-protein and toddler-friendly where possible.
- Include realistic prep and cook time as integer minutes: "prepMinutes" (hands-on prep)
  and "cookMinutes" (0 for no-cook meals). Keep dinners' prepMinutes + cookMinutes ≲ 30.
- Include "caloriesPerServing": the estimated kcal for a SINGLE person's portion.

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
