# Meal Prep Planner — Design

**Date:** 2026-07-12
**Status:** Approved (brainstorming complete, ready for implementation plan)

## One-line summary

A local React + Node/SQLite app where each week you enter your veg-box contents plus
a note, Claude (Opus 4.8, web search) curates a real-recipe plan of breakfast/lunch/
dinner built around using up that box — lean high-protein, no spicy, low-FODMAP, easy
30-min dinners, smart leftovers — and the backend deterministically scales portions for
the household (2 active adults + toddler) and builds an aisle-grouped shopping list,
with history + ratings for variety.

## Goals

- Weekly overview of meals (breakfast + lunch + dinner, every day).
- Ingredients per meal, and a consolidated shopping list with quantities.
- Optimize a week for shared ingredients / shared bases to minimize waste.
- Build the plan around a weekly vegetable delivery (random but known-in-advance veg).
- Portion sizing for the household; configurable later.
- Local persistence: history of past plans, ratings for future reference.
- Variety across cuisines/proteins/bases.
- Easy-prep meals; dietary restrictions honored (no spicy, low-FODMAP).

## Non-goals (first cut)

- Settings/config UI (settings live in the DB, seeded; edited via code for now).
- Multi-user / auth / cloud sync.
- Precise veg-box quantities (types only; assume typical amounts).
- Nutrition macro tracking beyond the "lean high-protein" steering rule.

## Household profile (seeded settings)

- 2 active adults (high-end consumption) + 1 toddler.
- Consumption factors (adult-equivalents): active adult ≈ 1.15, toddler ≈ 0.5 →
  household ≈ 2.8 adult-equivalents. (Exact factors finalized in the scaling function.)

## Standing food preferences (seeded settings)

- **Nutrition:** lean, high-protein focus — chicken, tuna, fish, turkey, eggs.
- **Protein cadence:** ~1 vegetarian meal/week OK; ~1 red/high-fat-meat meal/week OK;
  the rest lean protein. Avoid beans/legumes.
- **Restrictions (strict):** no spicy food; low-FODMAP (careful with onion/garlic —
  prefer garlic-infused oil, scallion greens, etc.).
- **Effort:** easy ~30-min dinners.
- **Meal realism:** dinners are the "real" cooked meals; lunches reuse dinner leftovers
  or shared bases (rice/chicken/tuna in different formats); breakfasts rotate from a
  small simple set.

## Weekly inputs

1. **Veg box contents** — list of vegetable *types* arriving this week (primary driver).
2. **Free-text note** — e.g. "keep it light, one Thai night, we have leftover rice".
3. **Avoid-repeat flags** — chosen from recent history (variety control).

## Architecture

Three layers; the API key must be server-side (never in the browser).

- **Frontend:** React + TypeScript + Vite. Single-page dashboard.
- **Backend:** Node + Express + SQLite (`better-sqlite3`). Owns the API key (gitignored
  `.env`), calls Claude, does all portion math + shopping-list aggregation + veg-coverage
  tracking, persists everything.
- **LLM:** `@anthropic-ai/sdk`, Claude **Opus 4.8** (`claude-opus-4-8`), **web search
  tool** enabled, output forced into a strict JSON schema via tool use.

**Core principle — LLM curates, code computes.** Claude finds/picks real recipes and
returns structured ingredients with quantities and source links. The backend
deterministically scales portions, sums the shopping list, and computes veg coverage.
We never trust the LLM for arithmetic, unit conversion, or set math.

## Data flow (weekly loop)

1. User opens "New week": enters veg-box contents, optional note, flags avoid-repeats.
2. Backend assembles prompt = standing config + weekly inputs + rules (protein cadence,
   low-FODMAP, no spicy, easy 30-min, maximize veg-box + shared-base reuse, leftover
   strategy, variety, avoid list).
3. Claude (Opus + web search) returns 7 days × {breakfast, lunch, dinner} as strict JSON:
   title, cuisine, protein, base, difficulty, ingredients [name, qty, unit, category],
   steps, `sourceUrl`, `leftoverOf` links.
4. Backend validates (zod), scales portions, aggregates shopping list, computes veg
   coverage, persists to SQLite.
5. Dashboard renders week grid + per-meal ingredients + aisle-grouped shopping list +
   veg-coverage warnings. User can swap/regenerate a single meal (targeted re-call) or
   the whole week. User rates meals afterward.

## Data model (SQLite)

- `settings` — household members + per-member consumption factor, restrictions, protein
  rules, effort, default veg quantities. Centralized for easy future config.
- `weekly_plans` — id, week_start, veg_box (json), note, status, created_at.
- `meals` — id, plan_id, day, slot, title, cuisine, protein, base, difficulty, servings,
  ingredients (json), steps (json), source_url, leftover_of, rating.
- `shopping_items` — derived per plan: name, total_qty, unit, category, checked.

## Portion / consumption model

Each member has a consumption factor (adult-equivalents). Recipes normalized to a
per-serving basis, then multiplied by the household factor. Leftover handling and
rounding-to-buyable-quantities are judgment calls captured in a dedicated scaling
function (user-authored during implementation).

## Shopping list

Aggregate all ingredients across the week, merge duplicates with light unit
normalization (g/kg, ml/l, count units), group by store aisle/category, show quantity to
buy with checkboxes. Merge logic user-authored during implementation.

## Veg-box coverage (waste minimization)

Deterministic set operation: delivered veg − veg used in meals = leftovers. Dashboard
warns about any delivered vegetable not used this week. Goal is to use it all.

## Variety & history

Plans + ratings persist. Avoid-repeat reads recent meals; low-rated meals down-weighted
in the prompt. Cuisine/protein/base spread checked so a week isn't monotonous.

## What's hardcoded now vs configurable later

Settings are real DB rows seeded with the profile above. No settings UI in the first cut,
but changing them later is an edit form, not a refactor.

## Learning-build contributions (user-authored during implementation)

Focused pieces of business logic with real judgment calls, to be written by the user:

- The portion-scaling function (household → serving multiplier; leftover + rounding).
- The shopping-list merge/aggregation (unit normalization + dedupe).
- The veg-coverage check (delivered − used, with fuzzy name matching).
