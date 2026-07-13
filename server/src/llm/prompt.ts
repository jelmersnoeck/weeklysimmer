import type {
  Settings,
  Meal,
  Slot,
  ProteinClass,
  EnabledSlot,
} from "../domain/types.js";
import { SLOTS } from "../domain/schedule.js";
import { householdServings } from "../domain/portions.js";

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

/** Turn a canonical key ("white_fish") into readable words ("white fish"). */
function label(key: string): string {
  return key.replace(/_/g, " ");
}

/** Join a list for prose, or a placeholder when empty. */
function orNone(items: string[]): string {
  return items.length > 0 ? items.join(", ") : "(none)";
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
 * A one-line diet guide for the household's selected frameworks, or "" when none is
 * selected (so the caller can omit the diet line entirely).
 */
function dietGuidance(settings: Settings): string {
  if (settings.diets.length === 0) return "";
  return `Follow these dietary frameworks: ${settings.diets.join(", ")} (explicit protein/taste selections still take precedence).`;
}

/**
 * Tell the model how the household reads quantities. Metric (g/ml) is ALWAYS the
 * canonical measure the app does its shopping math on; when the household also uses
 * cups, ask for an additional cup/spoon measure per ingredient where it makes sense.
 */
function measurementGuidance(settings: Settings): string {
  const lines = [
    `The household reads quantities in: ${settings.units.join(", ")}.`,
    `ALWAYS return a metric "quantity" + "unit" (grams or millilitres) as the canonical measure — the app does all shopping arithmetic in metric.`,
  ];
  if (settings.units.includes("cups")) {
    lines.push(
      `This household ALSO uses cups: for every ingredient where a cup/tablespoon/teaspoon measure makes sense, ALSO return "cupQuantity" (a number, per single serving) and "cupUnit" (one of "cup", "tbsp", "tsp"). Skip the cup measure for pure-count items like eggs.`,
    );
  }
  return lines.join(" ");
}

/** Describe the household's protein preferences weighted by frequency. */
function proteinProfile(settings: Settings): string {
  const byFreq = (f: string): string[] =>
    settings.proteins.filter((p) => p.frequency === f).map((p) => label(p.key));
  const often = byFreq("often");
  const weekly = byFreq("weekly");
  const occasionally = byFreq("occasionally");
  const excluded = byFreq("never");

  const lines = [
    `- Feature OFTEN (highest weighting): ${orNone(often)}.`,
    `- Include WEEKLY (medium weighting): ${orNone(weekly)}.`,
    `- Use OCCASIONALLY (low weighting): ${orNone(occasionally)}.`,
    `- EXCLUDE these proteins entirely (never use them): ${orNone(excluded)}.`,
  ];
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
  const avoidRepeat =
    avoid.length > 0 ? avoid.map((m) => `- ${m}`).join("\n") : "- (nothing yet)";
  const servings = householdServings(settings.household);
  const dietSection =
    settings.diets.length > 0
      ? `\n## Diet
${dietGuidance(settings)}
Use these frameworks as a general guide for the week, but honour the user's concrete
protein and taste choices first whenever they conflict with a diet label.\n`
      : "";

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

## Protein preferences (weight meals by these)
${proteinProfile(settings)}
Weight the week so higher-frequency proteins appear more often than lower ones.

## Taste preferences — lean TOWARD these
- Cuisines the household enjoys: ${orNone(settings.cuisinesLiked)}.
- Dish types they enjoy: ${orNone(settings.dishTypesLiked)}.
- Flavours they enjoy: ${orNone(settings.flavoursLiked)}.
- Vegetables they like: ${orNone(settings.vegetablesLiked)}.
- Fruits they like: ${orNone(settings.fruitsLiked)}.
Lean toward these preferences, but keep the week varied.

## Hard excludes (STRICT — always EXCLUDE)
Never use anything the household avoids: ${orNone(settings.avoid)}.
Treat these as strict allergen/dislike excludes — no meal may contain them.
${dietSection}
## Measurements
${measurementGuidance(settings)}

## Household portions & effort
Cook for ${servings} servings per meal (the app scales ingredient quantities; still,
plan realistic family-sized meals). Keep effort "${settings.effort}".
Dinners must be easy ~30-minute weeknight dinners (keep prepMinutes + cookMinutes ≲ 30).
Keep steps short and simple. Prefer bulk-staples-friendly recipes that share bases
(rice, pasta, potatoes) so shopping and cooking stay efficient.
Every meal MUST include realistic prep and cook time as integer minutes: "prepMinutes"
(hands-on prep) and "cookMinutes" (time actually cooking; use 0 for no-cook meals).
Every meal MUST also include "caloriesPerServing": the estimated kcal for a single
person's serving (the app scales portions, so this is per one serving, not the whole dish).
Classify each meal's proteinClass as exactly one of: "lean", "red_or_high_fat", "vegetarian".

## Snacks (two per day: mid-morning and mid-afternoon)
- Each day may have a "morning_snack" (mid-morning) and an "afternoon_snack" (mid-afternoon).
- Keep snacks simple and mostly no-cook or minimal prep — e.g. Greek yogurt, boiled
  eggs, cottage cheese, veg sticks, oatcakes, or fruit.
- Make them lean and high-protein where possible, and child-friendly.
- Snacks respect the same standing constraints (honour the avoid-list and diet). Snacks
  typically have "cookMinutes": 0.

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
 * The same standing household constraints apply (avoid-list, diet, easy ~30-minute
 * dinners), but the model returns a SINGLE replacement meal that must be meaningfully
 * different from the other meals already in the plan.
 */
export function buildRegeneratePrompt(input: RegeneratePromptInput): string {
  const { settings, day, slot, proteinClass, onHand, note, otherMeals } = input;

  const dayName = DAY_NAMES[day] ?? `day ${day}`;
  const proteinWords = PROTEIN_CLASS_WORDS[proteinClass];
  const onHandList = onHand.length > 0 ? onHand.join(", ") : "(nothing this week)";
  const otherTitles =
    otherMeals.length > 0
      ? otherMeals.map((m) => `- ${m.title}`).join("\n")
      : "- (none)";
  const dietLine = settings.diets.length > 0 ? `\n${dietGuidance(settings)}` : "";

  return `You are a meal-prep planner for a family household. Replace ONE meal in an
existing weekly plan and return it as a single structured meal.

## Target slot
Regenerate the meal for ${dayName} (day ${day}), slot: ${slot}.
User note for this week: ${note}

## Foods to use up — prefer using them up
The household already has these foods to use up: ${onHandList}. Prefer a recipe that
helps use up these foods so nothing goes to waste.

## Hard excludes (STRICT — always EXCLUDE)
Never use anything the household avoids: ${orNone(settings.avoid)}.${dietLine}
Cuisines they enjoy: ${orNone(settings.cuisinesLiked)}. Flavours they enjoy: ${orNone(settings.flavoursLiked)}.

## Protein class (STRICT — keep the week's balance)
This slot is a ${proteinWords} meal — the replacement MUST also be ${proteinWords} to
keep the week's protein balance. Do not switch it to a different protein class.

## Effort
- Keep it easy: an ~30-minute weeknight dinner with short, simple steps.
- If this slot is a snack (morning_snack or afternoon_snack), keep it simple and mostly
  no-cook or minimal prep (e.g. Greek yogurt, boiled eggs, cottage cheese, veg sticks,
  fruit) — lean, high-protein and child-friendly where possible.
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
- ${measurementGuidance(settings)}

Return the single meal as structured data matching the required schema.`;
}

/**
 * Build the (pure, no-network) prompt for the shopping-list CONSOLIDATION REVIEW.
 *
 * The LLM ONLY assigns each input item a canonical grocery-product name; deterministic
 * code re-merges the quantities afterwards (never trust the model for arithmetic). The
 * goal is to fold differently-worded names for the SAME purchasable product onto one
 * canonical, while keeping genuinely different products distinct.
 */
export function buildConsolidationPrompt(names: string[]): string {
  const list =
    names.length > 0 ? names.map((n) => `- ${n}`).join("\n") : "- (none)";

  return `You are reviewing a grocery shopping list. Each line is an item name that came
from recipe ingredients. Different recipes often name the SAME purchasable grocery
product differently (preparation words, varieties, brand-style adjectives).

## Your job
For EACH input item name below, return a "canonical" grocery-product name. Items that are
the SAME product a shopper would buy once should be given the SAME canonical name so the
app can merge them into a single shopping line.

## Items to review
${list}

## Merge items that are the SAME purchasable product
Ignore preparation and variety wording when the underlying product is the same thing you
buy at the shop:
- "cooked rice", "jasmine rice", "white rice" → "rice"
- "unsalted butter", "butter" → "butter"
- "baby spinach", "spinach" → "spinach"

## KEEP genuinely different products distinct
Do NOT merge products a shopper would buy separately, even if the words overlap:
- "brown rice" ≠ "rice" (white)
- "sweet potato" ≠ "potato"
- "coconut milk" ≠ "milk"
- "spring onion" ≠ "onion"

## Rules
- Return EVERY input name exactly once, each paired with its canonical.
- The canonical MAY equal the input name (leave it as-is when it is already canonical or
  has no match to merge with).
- When UNSURE whether two items are the same product, keep them SEPARATE — do not
  over-merge.

Return the mapping as structured data matching the required schema (an "items" array of
{ "name", "canonical" } objects).`;
}
