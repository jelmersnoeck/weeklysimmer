# Meal Prep Planner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local web app that curates a weekly breakfast/lunch/dinner plan around a
vegetable-box delivery using Claude (web search), then deterministically scales portions
and builds an aisle-grouped shopping list, with history and ratings.

**Architecture:** Three layers — React/Vite frontend, Node/Express backend that owns the
Claude API key + does all deterministic math + SQLite persistence, and Claude Opus 4.8 for
recipe curation via web search with strict JSON (tool-use) output. LLM curates; code
computes (never trust the LLM for arithmetic, unit merges, or set math).

**Tech Stack:** TypeScript everywhere. Backend: Express, better-sqlite3, zod,
@anthropic-ai/sdk, vitest. Frontend: React, Vite, vitest + React Testing Library.

**Skills to consult during execution:**
- `@claude-api` — BEFORE writing any Anthropic integration (model IDs, web search tool,
  tool-use structured output, streaming). Do not write the LLM call from memory.
- `@superpowers:test-driven-development` — every task below is red→green→commit.
- `@frontend-design` — before building the dashboard UI (Phase 6).

**Learning-build note:** Tasks tagged **[USER-AUTHORED]** are for the human to implement.
Claude writes the failing tests + surrounding scaffolding and stops at a clear TODO. These
carry the real judgment calls (portion scaling, shopping-list merge, veg coverage).

---

## Repository layout (target)

```
mealplanner/
  package.json            # root: workspaces + dev scripts (concurrently)
  server/
    package.json
    tsconfig.json
    vitest.config.ts
    .env.example
    src/
      db/                 # schema, migrations, seed
      domain/             # deterministic core (scaling, shopping, coverage, types)
      llm/                # anthropic client, prompt builder, schema, curation service
      routes/             # express route handlers
      app.ts              # express app factory
      server.ts           # entrypoint (listen)
    test/                 # vitest tests mirroring src/
  client/
    package.json
    tsconfig.json
    vite.config.ts
    index.html
    src/
      api/                # fetch wrappers to backend
      components/
      pages/
      types.ts            # shared shape (mirrors domain types)
      main.tsx
    test/
```

---

## Phase 0 — Scaffolding & tooling

### Task 0.1: Root workspace + scripts

**Files:**
- Create: `package.json`

**Step 1:** Create root `package.json` with npm workspaces and dev orchestration:

```json
{
  "name": "mealplanner",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"npm -w server run dev\" \"npm -w client run dev\"",
    "test": "npm -w server test && npm -w client test",
    "build": "npm -w server run build && npm -w client run build"
  },
  "devDependencies": {
    "concurrently": "^9.1.0"
  }
}
```

**Step 2:** `npm install`. Expected: workspaces resolve (server/client may be empty stubs
until their package.json exist — create those in 0.2/0.3 then reinstall).

**Step 3:** Commit: `chore: root workspace scaffolding`.

### Task 0.2: Backend package + TypeScript + vitest

**Files:**
- Create: `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`,
  `server/.env.example`, `server/src/server.ts` (temporary hello listener)

**Step 1:** `server/package.json`:

```json
{
  "name": "server",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.68.0",
    "better-sqlite3": "^11.8.0",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/express": "^5.0.0",
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

> Confirm the `@anthropic-ai/sdk` version against the `@claude-api` skill during execution;
> pin to the latest it recommends.

**Step 2:** `server/tsconfig.json` — NodeNext module resolution, strict true, outDir dist,
target ES2022. `server/vitest.config.ts` — default node environment.

**Step 3:** `server/.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-...
PORT=3001
DATABASE_PATH=./mealplanner.db
```

**Step 4:** `server/src/server.ts` temporary:

```ts
import express from "express";
const app = express();
app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(3001, () => console.log("server on 3001"));
```

**Step 5:** `npm install`, then `npm -w server run dev`, curl `localhost:3001/health` →
`{"ok":true}`. Commit: `chore: backend scaffolding`.

### Task 0.3: Frontend package (Vite + React + TS + vitest)

**Files:**
- Create: `client/package.json`, `client/vite.config.ts`, `client/tsconfig.json`,
  `client/index.html`, `client/src/main.tsx`, `client/src/App.tsx`

**Step 1:** Scaffold a minimal Vite React-TS app manually (avoid interactive
`create-vite`). `client/package.json` deps: `react`, `react-dom`; dev: `vite`,
`@vitejs/plugin-react`, `typescript`, `vitest`, `@testing-library/react`,
`@testing-library/jest-dom`, `jsdom`, `@types/react`, `@types/react-dom`.

**Step 2:** `vite.config.ts` sets a dev proxy so `/api` → `http://localhost:3001`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3001" } },
  test: { environment: "jsdom", setupFiles: "./test/setup.ts" },
});
```

**Step 3:** Minimal `App.tsx` renders "Meal Planner". Add a render smoke test.

**Step 4:** `npm install` at root, `npm run dev` → both servers boot; client shows text.
Commit: `chore: frontend scaffolding`.

---

## Phase 1 — Domain types & data layer

### Task 1.1: Domain types

**Files:**
- Create: `server/src/domain/types.ts`

Define the canonical TypeScript types (no logic yet), shared conceptually with the client:

```ts
export type Slot = "breakfast" | "lunch" | "dinner";
export type Difficulty = "easy" | "medium" | "hard";
export type ProteinClass = "lean" | "red_or_high_fat" | "vegetarian";

export interface Ingredient {
  name: string;
  quantity: number;      // per single recipe serving (normalized)
  unit: string;          // "g" | "ml" | "clove" | "piece" | "tbsp" | ...
  category: string;      // shopping aisle: "produce" | "meat" | "dairy" | ...
}

export interface Meal {
  id?: number;
  day: number;           // 0=Mon .. 6=Sun
  slot: Slot;
  title: string;
  cuisine: string;
  proteinClass: ProteinClass;
  base: string;          // "rice" | "pasta" | "potato" | "none" | ...
  difficulty: Difficulty;
  ingredients: Ingredient[];
  steps: string[];
  sourceUrl?: string;
  leftoverOf?: { day: number; slot: Slot } | null;
  rating?: number | null; // 1-5
}

export interface HouseholdMember { label: string; consumptionFactor: number; }

export interface Settings {
  members: HouseholdMember[];
  restrictions: string[];        // ["no_spicy", "low_fodmap"]
  avoidIngredients: string[];    // ["beans", "lentils", ...]
  proteinCadence: { veg_per_week: number; red_or_high_fat_per_week: number };
  effort: Difficulty;
  defaultVegQuantities: Record<string, { quantity: number; unit: string }>;
}

export interface WeeklyPlan {
  id?: number;
  weekStart: string;   // ISO date (Monday)
  vegBox: string[];    // vegetable type names
  note: string;
  status: "draft" | "active" | "archived";
  meals: Meal[];
}

export interface ShoppingItem {
  name: string;
  totalQuantity: number;
  unit: string;
  category: string;
  checked: boolean;
}
```

Commit: `feat: domain types`.

### Task 1.2: SQLite schema + connection (TDD)

**Files:**
- Create: `server/src/db/schema.sql`, `server/src/db/index.ts`
- Test: `server/test/db/index.test.ts`

**Step 1 (red):** Test that opening an in-memory DB and running the schema creates the
tables `settings`, `weekly_plans`, `meals`, `shopping_items`.

```ts
import { openDb } from "../../src/db/index.js";
test("schema creates all tables", () => {
  const db = openDb(":memory:");
  const names = db.prepare(
    "select name from sqlite_master where type='table'"
  ).all().map((r: any) => r.name);
  for (const t of ["settings", "weekly_plans", "meals", "shopping_items"])
    expect(names).toContain(t);
});
```

**Step 2:** Run → FAIL (no module).

**Step 3 (green):** Write `schema.sql` (tables per the data model in the design doc; store
`veg_box`, `ingredients`, `steps` as JSON text columns) and `openDb(path)` that opens
better-sqlite3, sets `PRAGMA journal_mode=WAL`, and executes the schema idempotently
(`CREATE TABLE IF NOT EXISTS`).

**Step 4:** Run → PASS. **Step 5:** Commit `feat: sqlite schema + connection`.

### Task 1.3: Settings seed (TDD)

**Files:**
- Create: `server/src/db/seed.ts`
- Test: `server/test/db/seed.test.ts`

**Step 1 (red):** Test that `seedSettings(db)` inserts exactly one settings row and that
reading it back yields: 3 members (2 adults @1.15, toddler @0.5), restrictions
`["no_spicy","low_fodmap"]`, `veg_per_week: 1`, `red_or_high_fat_per_week: 1`,
effort `"easy"`, and `avoidIngredients` including `"beans"`.

**Step 2:** FAIL. **Step 3 (green):** Implement `seedSettings` to upsert the profile from
the design doc as a JSON blob (or normalized columns — JSON blob is fine here). Include a
starter `defaultVegQuantities` map (e.g. carrot 300g, leek 2 piece, spinach 200g...).

**Step 4:** PASS. **Step 5:** Commit `feat: seed household settings`.

### Task 1.4: Plan repository (TDD)

**Files:**
- Create: `server/src/db/plansRepo.ts`
- Test: `server/test/db/plansRepo.test.ts`

**Step 1 (red):** Tests for `savePlan(db, plan)` → returns id; `getPlan(db, id)` →
round-trips meals (JSON fields parsed back to arrays); `listPlans(db)` → returns summaries
newest-first; `rateMeal(db, mealId, rating)` updates rating; `saveShoppingItems` +
`getShoppingItems` round-trip.

**Step 2:** FAIL. **Step 3 (green):** Implement repo functions with prepared statements,
JSON (de)serialization for `veg_box`/`ingredients`/`steps`/`leftover_of`, inside a
transaction for `savePlan`.

**Step 4:** PASS. **Step 5:** Commit `feat: plan repository`.

---

## Phase 2 — Deterministic core (the trustworthy math)

### Task 2.1: Household portion factor (TDD) — [USER-AUTHORED]

**Files:**
- Create: `server/src/domain/portions.ts`
- Test: `server/test/domain/portions.test.ts`

**Context for the user:** Recipes come back normalized to *per single serving*. We must
multiply by the household's total consumption. But there are real choices: do you round up
to whole servings (so nobody's short)? Does a toddler count the same for breakfast as
dinner? For the first cut we keep it simple but the rounding rule is yours to decide.

**Step 1 (red) — Claude writes these tests:**

```ts
import { householdServings, scaleIngredient } from "../../src/domain/portions.js";
import type { HouseholdMember, Ingredient } from "../../src/domain/types.js";

const household: HouseholdMember[] = [
  { label: "Adult A", consumptionFactor: 1.15 },
  { label: "Adult B", consumptionFactor: 1.15 },
  { label: "Toddler", consumptionFactor: 0.5 },
];

test("householdServings sums factors and rounds up to whole servings", () => {
  // 1.15 + 1.15 + 0.5 = 2.8 -> round up to 3 servings
  expect(householdServings(household)).toBe(3);
});

test("scaleIngredient multiplies per-serving quantity by servings", () => {
  const ing: Ingredient = { name: "rice", quantity: 60, unit: "g", category: "grains" };
  expect(scaleIngredient(ing, 3)).toEqual({ ...ing, quantity: 180 });
});
```

**Step 2:** Run → FAIL (functions not defined).

**Step 3 — [USER-AUTHORED]:** Claude creates `portions.ts` with signatures + TODO:

```ts
import type { HouseholdMember, Ingredient } from "./types.js";

/**
 * Total whole servings to cook for the household.
 * Sum each member's consumptionFactor, then decide a rounding rule
 * (recommended: round UP so nobody goes hungry).
 */
export function householdServings(members: HouseholdMember[]): number {
  // TODO(you): implement. ~3 lines.
  throw new Error("not implemented");
}

/** Scale a per-serving ingredient quantity to `servings`. */
export function scaleIngredient(ing: Ingredient, servings: number): Ingredient {
  // TODO(you): implement. ~1 line.
  throw new Error("not implemented");
}
```

**Step 4:** After the user implements, run → PASS.
**Step 5:** Commit `feat: household portion scaling`.

### Task 2.2: Shopping-list aggregation (TDD) — [USER-AUTHORED]

**Files:**
- Create: `server/src/domain/shopping.ts`, `server/src/domain/units.ts`
- Test: `server/test/domain/shopping.test.ts`

**Context for the user:** Combine every ingredient across all meals (already portion-scaled)
into one buy list. The judgment calls: how to merge the same ingredient with compatible
units (g+kg, ml+l), how to treat count units (clove/piece), and how to group by aisle. A
small `units.ts` helper (provided by Claude) normalizes g/kg and ml/l; you decide how the
merge uses it.

**Step 1 (red) — Claude writes tests** covering: two meals each needing 180g rice → one
line "rice 360 g"; "1 kg" + "200 g" chicken → "1.2 kg" (or "1200 g" — your call, assert
what you implement); different categories grouped; unknown/incompatible units kept as
separate lines rather than silently summed.

**Step 2:** FAIL.

**Step 3 — [USER-AUTHORED]:** Claude provides `units.ts` (a `toBaseUnit`/`fromBaseUnit`
helper for mass + volume) fully implemented, plus `shopping.ts` skeleton:

```ts
import type { Meal, ShoppingItem } from "./types.js";
/**
 * Aggregate all meal ingredients into a shopping list.
 * - merge same-name ingredients with compatible units (use units.ts)
 * - keep incompatible units as separate lines
 * - group/sort by category (aisle)
 */
export function buildShoppingList(meals: Meal[]): ShoppingItem[] {
  // TODO(you): implement. ~15 lines.
  throw new Error("not implemented");
}
```

**Step 4:** PASS after user implements. **Step 5:** Commit `feat: shopping list aggregation`.

### Task 2.3: Veg-box coverage (TDD) — [USER-AUTHORED]

**Files:**
- Create: `server/src/domain/coverage.ts`
- Test: `server/test/domain/coverage.test.ts`

**Context for the user:** Waste warning = which delivered vegetables never appeared in any
meal. The nuance is fuzzy matching: the box says "carrots" but a recipe ingredient is
"carrot, grated" or "baby carrots". You decide how forgiving the match is (case-insensitive
substring? singular/plural normalization?).

**Step 1 (red) — Claude writes tests:** box `["carrots","leek","spinach"]`, meals use
"carrot" and "baby spinach" → unused `["leek"]`. Exact/again decide the matching rule and
assert accordingly.

**Step 2:** FAIL.

**Step 3 — [USER-AUTHORED]:** `coverage.ts`:

```ts
import type { Meal } from "./types.js";
/** Return delivered veg names that no meal used (waste warning). */
export function unusedVegetables(vegBox: string[], meals: Meal[]): string[] {
  // TODO(you): implement fuzzy matching. ~8 lines.
  throw new Error("not implemented");
}
```

**Step 4:** PASS. **Step 5:** Commit `feat: veg-box coverage check`.

---

## Phase 3 — LLM curation service

> **BEFORE this phase:** consult the `@claude-api` skill for the exact web-search tool
> block, tool-use structured-output pattern, model id (`claude-opus-4-8`), and SDK usage.
> Do not hand-write the request shape from memory.

### Task 3.1: Curation output schema (zod) (TDD)

**Files:**
- Create: `server/src/llm/planSchema.ts`
- Test: `server/test/llm/planSchema.test.ts`

**Step 1 (red):** Tests that `planSchema` (zod) accepts a well-formed 21-meal plan object
and rejects: missing `slot`, negative ingredient quantity, `proteinClass` outside the enum,
non-array `steps`. Also test `planSchema.parse` normalizes/keeps `leftoverOf: null`.

**Step 2:** FAIL. **Step 3 (green):** Define the zod schema mirroring `types.ts` (this is
the JSON contract the LLM must satisfy). Export both the schema and the inferred TS type.

**Step 4:** PASS. **Step 5:** Commit `feat: llm plan schema`.

### Task 3.2: Prompt builder (TDD)

**Files:**
- Create: `server/src/llm/prompt.ts`
- Test: `server/test/llm/prompt.test.ts`

**Step 1 (red):** Test `buildCurationPrompt({ settings, vegBox, note, avoid })` returns a
string that includes: every veg-box item, the low-FODMAP + no-spicy rules, the protein
cadence (1 veg / 1 red per week, rest lean), "easy ~30 min dinners", the leftovers/shared-
base strategy, the avoid list, and an explicit instruction to use the web search tool for
real recipes and return ONLY the tool call matching the schema.

**Step 2:** FAIL. **Step 3 (green):** Implement a pure function assembling the prompt from
inputs (no network). Keep the wording in one place so it's tunable.

**Step 4:** PASS. **Step 5:** Commit `feat: curation prompt builder`.

### Task 3.3: Anthropic client wrapper (TDD with mock)

**Files:**
- Create: `server/src/llm/anthropicClient.ts`
- Test: `server/test/llm/anthropicClient.test.ts`

**Step 1 (red):** Inject a fake Anthropic client (dependency injection: the wrapper takes a
`client` param). Test that `curateWeek(fakeClient, input)`:
- calls `messages.create` with model `claude-opus-4-8`, the web search tool enabled, and a
  tool for structured output;
- extracts the structured tool_use input from the response;
- validates it with `planSchema` and returns a typed plan;
- throws a clear error if the response fails schema validation.

Use a fake that returns a canned valid tool_use block, and a second fake returning garbage
to test the validation-failure path.

**Step 2:** FAIL. **Step 3 (green):** Implement per the `@claude-api` skill guidance
(web_search tool + a "record_plan" tool whose input_schema is the JSON-schema form of
`planSchema`; force tool use). Parse, validate, return. Real client construction lives in a
tiny factory reading `ANTHROPIC_API_KEY`, kept out of the tested unit.

**Step 4:** PASS. **Step 5:** Commit `feat: anthropic curation wrapper`.

### Task 3.4: Curation service (assembles the pieces) (TDD)

**Files:**
- Create: `server/src/llm/curationService.ts`
- Test: `server/test/llm/curationService.test.ts`

**Step 1 (red):** With a fake anthropic client returning a canned plan, test
`generatePlan(db, fakeClient, { weekStart, vegBox, note, avoid })`:
- builds prompt, calls wrapper, scales every ingredient by `householdServings(settings)`,
  builds the shopping list, computes unused vegetables, and returns
  `{ plan, shopping, unusedVeg }` without yet persisting (persistence is the route's job).

**Step 2:** FAIL. **Step 3 (green):** Compose Phase 2 + 3 functions. **Step 4:** PASS.
**Step 5:** Commit `feat: curation service`.

---

## Phase 4 — Backend API

### Task 4.1: Express app factory + settings route (TDD)

**Files:**
- Create: `server/src/app.ts`, `server/src/routes/settings.ts`
- Modify: `server/src/server.ts` (use the factory)
- Test: `server/test/routes/settings.test.ts` (supertest-style via `app`)

**Step 1 (red):** `GET /api/settings` returns the seeded settings JSON.
**Step 2:** FAIL. **Step 3 (green):** `createApp(db)` returns configured express app;
mount settings route. Server entrypoint opens the real DB, seeds if empty, listens.
**Step 4:** PASS. **Step 5:** Commit `feat: app factory + settings route`.

### Task 4.2: Plans routes (TDD)

**Files:**
- Create: `server/src/routes/plans.ts`
- Test: `server/test/routes/plans.test.ts`

**Step 1 (red):** With the anthropic client injected as a fake on the app:
- `POST /api/plans/generate` with `{ weekStart, vegBox, note, avoid }` → 201, returns
  `{ plan, shopping, unusedVeg }`, and persists (subsequent GET finds it).
- `GET /api/plans` → list of summaries.
- `GET /api/plans/:id` → full plan + shopping items.
- `POST /api/plans/:id/meals/:mealId/regenerate` → swaps a single meal (fake returns one
  meal); re-aggregates shopping list.
- `POST /api/meals/:mealId/rate` `{ rating }` → 200, persists rating.

**Step 2:** FAIL. **Step 3 (green):** Implement routes calling the curation service +
repo. Wire the real anthropic client factory in `server.ts`; tests inject a fake via
`createApp(db, { anthropic })`.

**Step 4:** PASS. **Step 5:** Commit `feat: plans + ratings routes`.

---

## Phase 5 — Frontend

> **BEFORE this phase:** consult the `@frontend-design` skill for visual direction so the
> dashboard isn't generic. Keep it clean, calm, kitchen-friendly.

### Task 5.1: API client + types

**Files:** Create `client/src/types.ts` (mirror domain types), `client/src/api/client.ts`
(typed `fetch` wrappers for the routes). Add a smoke test that `generatePlan` posts to the
right URL (mock `fetch`). Commit `feat: client api layer`.

### Task 5.2: New-week form

**Files:** Create `client/src/components/NewWeekForm.tsx` + test. Inputs: week start,
veg-box chips (type + Enter to add), free-text note, and a multiselect of recent meals to
avoid (fetched from `/api/plans`). On submit calls `generatePlan`. TDD the chip add/remove
and submit-payload shape. Commit `feat: new week form`.

### Task 5.3: Week grid + meal detail

**Files:** Create `client/src/components/WeekGrid.tsx`, `MealCard.tsx`, `MealDetail.tsx`
+ tests. Grid = 7 days × 3 slots; leftover meals visually linked to their source; clicking
a meal opens ingredients + steps + source link + a "regenerate this meal" button + star
rating. TDD render + rating call. Commit `feat: week grid and meal detail`.

### Task 5.4: Shopping list + veg-coverage warning

**Files:** Create `client/src/components/ShoppingList.tsx`, `VegCoverageBanner.tsx`
+ tests. Shopping list grouped by category with check-off (local state ok for first cut);
banner shows unused vegetables prominently. TDD grouping render + unused-veg banner.
Commit `feat: shopping list and coverage banner`.

### Task 5.5: History + dashboard assembly

**Files:** Create `client/src/pages/Dashboard.tsx`, `client/src/pages/History.tsx`, wire
into `App.tsx` (simple tab/route switch — no router lib needed for two views). Dashboard =
current/most-recent plan (grid + shopping + banner) with a "New week" action. History =
past plans with ratings, click to reopen. Commit `feat: dashboard + history`.

---

## Phase 6 — End-to-end wiring & manual verification

### Task 6.1: Seed-on-boot + real key smoke

**Files:** Modify `server/src/server.ts` to seed settings if the table is empty and
construct the real anthropic client from `.env`.

**Step 1:** Copy `.env.example` → `.env`, add real `ANTHROPIC_API_KEY`.
**Step 2:** `npm run dev`. In the UI, enter a veg box (e.g. carrots, leek, spinach,
courgette, bell pepper) + note "one Thai-inspired mild night, keep dinners under 30 min",
generate.
**Step 3:** Verify by observation (use `@verify` / `@webapp-testing`): 21 meals appear;
dinners look easy/lean; ~1 veg + ~1 red-meat meal; shopping list quantities look scaled
for ~3 servings; unused-veg banner is correct; ratings persist across reload; a single-meal
regenerate updates the shopping list.
**Step 4:** Commit `chore: seed on boot + wire real anthropic client`.

### Task 6.2: README

**Files:** Create `README.md` — setup (`npm install`, `.env`), `npm run dev`, architecture
one-paragraph, and where the seeded settings live for future editing. Commit `docs: readme`.

---

## Verification checklist (run before declaring done — `@verification-before-completion`)

- [ ] `npm test` green across server + client.
- [ ] `npm run build` succeeds for both.
- [ ] Fresh DB seeds the household profile automatically.
- [ ] A generated week respects: no-spicy, low-FODMAP, ≤1 veg + ≤1 red-meat meal, easy
      dinners, breakfast/lunch reuse.
- [ ] Shopping quantities are portion-scaled and merged sanely.
- [ ] Unused-veg warning matches reality.
- [ ] History + ratings persist across restart.
- [ ] `.env` is gitignored; no key committed.

---

## Deferred (explicitly NOT in first cut — YAGNI)

- Settings UI, multi-household, auth, cloud sync.
- Precise veg-box quantities.
- Macro/calorie tracking.
- Carrying unused veg into next week automatically (warn only for now).
