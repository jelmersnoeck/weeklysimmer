# Meal Prep Planner

A local web app that plans a week of meals around your **vegetable-box delivery**.
Each week you enter the veg you know is arriving plus an optional note; Claude
(Opus 4.8, with web search) curates real recipes built around using up that box —
lean and high-protein, no spicy, low-FODMAP, easy ~30-minute dinners, with smart
leftovers. The app then scales portions for your household, builds an aisle-grouped
shopping list, and warns about any delivered veg that didn't get used. Past weeks
and meal ratings are saved for variety.

## How it works

Three layers. The Claude API key stays server-side (never in the browser).

- **client/** — React + Vite dashboard ("The Prep Sheet"). Talks only to `/api`.
- **server/** — Express + SQLite. Owns the API key, calls Claude, and does all the
  deterministic math (portion scaling, shopping-list aggregation, veg-coverage).
- **Claude** — Opus 4.8 with the web search tool, returning a strict, schema-validated
  plan. **The LLM curates; the code computes** — quantities, unit merges, and the
  used/unused-veg check are never left to the model.

## Setup

Requires Node 20+ (better-sqlite3 compiles a native module on install).

```bash
npm install                      # installs both workspaces
cp server/.env.example server/.env
# edit server/.env and set ANTHROPIC_API_KEY=sk-ant-...
```

## Run

```bash
npm run dev                      # starts server (:3001) and client (:5173) together
```

Open the client URL Vite prints. The dev server proxies `/api` to the backend, so
there's no CORS to configure. On first boot the backend creates `server/mealplanner.db`
and seeds the household profile.

## Test / build

```bash
npm test                         # server (vitest) + client (vitest + RTL)
npm run build                    # typecheck + build both packages
```

## Your household profile

Settings (household members and their consumption factors, dietary restrictions,
protein cadence, effort level, default veg quantities) are seeded into the `settings`
table on first boot by [`server/src/db/seed.ts`](server/src/db/seed.ts). There's no
settings screen yet — to change your profile, edit the seed values and reset the DB:

```bash
rm server/mealplanner.db*        # then restart; it reseeds
```

Current seed: 2 active adults (factor 1.15 each) + 1 toddler (0.5) → 3 servings/meal;
no spicy, low-FODMAP; ~1 vegetarian and ~1 red/high-fat-meat meal per week, the rest
lean protein; easy ~30-minute dinners.

## Weekly flow

1. **New week** → pick the Monday-started week (defaults to the coming Monday),
   type the vegetables in your box, add a note, flag any recent meals to avoid.
2. Claude curates breakfast/lunch/dinner for all 7 days around that veg.
3. The dashboard shows the week board, each meal's ingredients and steps, the
   shopping list grouped by aisle, and a coverage strip flagging any unused veg.
4. Rate meals and swap individual ones you don't like; history is kept for variety.

## Design docs

- [Design](docs/plans/2026-07-12-mealplanner-design.md)
- [Implementation plan](docs/plans/2026-07-12-mealplanner-implementation.md)
