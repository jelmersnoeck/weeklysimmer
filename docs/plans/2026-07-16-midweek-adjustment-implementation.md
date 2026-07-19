# Mid-week plan adjustment — Implementation Plan

> **For agentic workers:** implement task-by-task, TDD, commit after each task.

**Goal:** Let a household adjust the current week partway through it — freeze the meals
already eaten, re-plan the rest from a free-text note, and show a shopping delta (new to
buy + now-leftover), keeping a snapshot each time.

**Architecture:** New `POST /plans/:id/adjust` background job. The LLM returns a *change
set* (replacement meals + removals) for the adjustable region only; deterministic code
applies it surgically (keeping untouched meals' ids/ratings), recomputes the shopping
list, and diffs old-vs-new for the delta. A `plan_snapshots` table records each
pre-adjustment state.

**Tech Stack:** Node + Express + better-sqlite3 + zod (server); React + Vite (client);
vitest.

## Global Constraints

- Slot order: `breakfast=0, morning_snack=1, lunch=2, afternoon_snack=3, dinner=4`.
- Cutoff ordinal = `day * 10 + slotOrder[slot]`. Frozen = ordinal `<` cutoff; adjustable
  = ordinal `>=` cutoff.
- Principle: LLM curates (which meals to change, real recipes); code computes (freezing,
  scaling, delta arithmetic). Never trust the model for quantities or set logic.
- Model id stays `claude-opus-4-8` via existing `curateStructured` (web search enabled).

---

## Task 1: Domain — cutoff ordinal + change-set application (pure)

**Files:**
- Create: `server/src/domain/adjust.ts`
- Test: `server/test/domain/adjust.test.ts`

**Produces:**
- `slotOrdinal(slot: Slot): number`
- `cellOrdinal(day: number, slot: Slot): number`
- `isFrozen(day, slot, cutoff: {day, slot}): boolean` (true when cell ordinal < cutoff)
- `partitionMeals(meals: Meal[], cutoff): { frozen: Meal[]; adjustable: Meal[] }`

- [ ] **Step 1: failing test** — `frozen`/`adjustable` split at a Wednesday-lunch cutoff;
  `isFrozen` true for Mon dinner, false for Wed lunch itself.
- [ ] **Step 2:** run `npm -w server test -- adjust` → FAIL (module missing).
- [ ] **Step 3: implement** using `SLOTS.indexOf(slot)` for the ordinal.
- [ ] **Step 4:** run test → PASS.
- [ ] **Step 5:** commit `feat(server): cutoff + meal partition helpers`.

## Task 2: Domain — shopping delta (pure)

**Files:**
- Modify: `server/src/domain/shopping.ts`
- Test: `server/test/domain/shopping.test.ts` (add a `describe`)

**Produces:**
- `shoppingDelta(oldItems: ShoppingItem[], newItems: ShoppingItem[]): { toBuy: ShoppingItem[]; leftover: ShoppingItem[] }`
  - Key = `${name.toLowerCase()}|${unit}`. For each key: `toBuy` gets `max(0, new-old)`,
    `leftover` gets `max(0, old-new)` (each as a ShoppingItem with `totalQuantity` = the
    delta, `checked:false`). Zero deltas produce no line. Sorted by category then name.

- [ ] **Step 1: failing test** — old has `rice 200g`, new has `rice 500g` + `tofu 300g`,
  and old-only `chicken 150g` → `toBuy` = rice 300g + tofu 300g; `leftover` = chicken 150g.
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: implement** (reuse category/cupUnit from the side that has the item).
- [ ] **Step 4:** run → PASS.
- [ ] **Step 5:** commit `feat(server): shopping delta diff`.

## Task 3: DB — plan_snapshots table + repo

**Files:**
- Modify: `server/src/db/schema.sql` (add table), `server/src/db/plansRepo.ts`
- Test: `server/test/db/plansRepo.test.ts`

**Produces (in plansRepo.ts):**
- `interface PlanSnapshot { id: number; note: string; cutoffDay: number; cutoffSlot: Slot; createdAt: string; meals: Meal[]; shopping: ShoppingItem[] }`
- `saveSnapshot(db, planId, { note, cutoffDay, cutoffSlot, meals, shopping }): number`
- `listSnapshots(db, planId): PlanSnapshot[]` (newest first)
- `addMeal(db, planId, meal: Meal): number`
- `deleteMeal(db, mealId): void`

Add to `schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS plan_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '',
  cutoff_day INTEGER NOT NULL,
  cutoff_slot TEXT NOT NULL,
  plan_json TEXT NOT NULL,
  shopping_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```
`schema.sql` is copied to `dist/` by the build; `openDb` runs it via `IF NOT EXISTS`, so
existing DBs get the new table automatically. `addMeal` reuses the same INSERT columns as
`savePlan`'s `insertMeal`; `deleteMeal` is `DELETE FROM meals WHERE id = ?`.

- [ ] Test: save a snapshot then `listSnapshots` returns it with round-tripped meals/shopping;
  `addMeal` then `getPlan` includes it; `deleteMeal` removes it. Run → FAIL → implement → PASS.
- [ ] Commit `feat(server): plan snapshots + meal add/delete repo`.

## Task 4: LLM — AdjustResult schema

**Files:**
- Modify: `server/src/llm/planSchema.ts`
- Test: `server/test/llm/planSchema.test.ts`

**Produces:**
```ts
export const adjustResultSchema = z.object({
  changes: z.array(rawMealSchema),
  removals: z.array(z.object({ day: z.number().int().min(0).max(6), slot: slotSchema })),
});
export type AdjustResult = z.infer<typeof adjustResultSchema>;
```
- [ ] Test: a well-formed `{changes:[rawMeal], removals:[{day,slot}]}` parses; empty arrays
  parse; a change with a bad slot fails. Run → FAIL → implement → PASS. Commit.

## Task 5: LLM — buildAdjustPrompt

**Files:**
- Modify: `server/src/llm/prompt.ts`
- Test: `server/test/llm/prompt.test.ts`

**Produces:**
```ts
export interface AdjustPromptInput {
  settings: Settings; note: string;
  frozenMeals: Meal[]; futureMeals: Meal[]; onHand: string[];
}
export function buildAdjustPrompt(input: AdjustPromptInput): string
```
Prompt reuses `proteinProfile`, `measurementGuidance`, `orNone`, `dietGuidance`. It must:
- list frozen meal titles under "Already eaten this week — do NOT repeat and do NOT change";
- list future meals as day/slot/title/proteinClass — "the current plan for the rest of the week";
- embed the directional `note` prominently — "apply this to the rest of the week";
- require standing constraints (avoid, diet, effort, ~30-min dinners, portions/servings);
- require it to keep protein balance + variety and fix dependent leftovers;
- specify the change-set output: only `changes` for cells to change + `removals` for cells
  to clear; leave everything else untouched; real recipes via web search, per-serving
  quantities + categories.

- [ ] Test: output includes a frozen title, the note text, a future title, and the word
  "removals"/"change". Run → FAIL → implement → PASS. Commit `feat(server): adjust prompt`.

## Task 6: LLM — adjustWeek on the curator port

**Files:**
- Modify: `server/src/llm/anthropicClient.ts`
- Test: `server/test/llm/anthropicClient.test.ts`

**Produces:**
```ts
export interface AdjustWeekInput {
  settings: Settings; note: string;
  frozenMeals: Meal[]; futureMeals: Meal[]; onHand: string[];
}
// on PlanCurator:
adjustWeek(input: AdjustWeekInput): Promise<AdjustResult>;
```
Implement in `createAnthropicCurator` as
`curateStructured(client, adjustResultSchema, buildAdjustPrompt(input), "adjustment")`.
- [ ] Test: a fake `MinimalAnthropicClient` returning a parsed AdjustResult → `adjustWeek`
  resolves to it. Run → FAIL → implement → PASS. Commit.

## Task 7: Jobs — carry a shopping delta result

**Files:**
- Modify: `server/src/jobs/registry.ts`
- Test: `server/test/jobs/registry.test.ts`

**Produces:** extend `Job` with `result: ShoppingDelta | null` (default null) where
`ShoppingDelta = { toBuy: ShoppingItem[]; leftover: ShoppingItem[] }` (define+export here or
import from domain). Change `markDone(id, planId, result?: ShoppingDelta)` to store it.
Existing generation calls `markDone(id, planId)` → `result` stays null (back-compatible).
- [ ] Test: `markDone(id, 1, delta)` → `getJob(id).result` equals delta; `markDone(id,1)` → null.
  Run → FAIL → implement → PASS. Commit.

## Task 8: Jobs — enqueueAdjustment

**Files:**
- Create: `server/src/jobs/adjustment.ts`
- Test: `server/test/jobs/adjustment.test.ts`

**Consumes:** Tasks 1–7. **Produces:**
```ts
export interface AdjustmentInput {
  planId: number; weekStart: string; note: string; cutoffDay: number; cutoffSlot: Slot;
}
export function enqueueAdjustment(deps: {db; curator; store}, input): { jobId: string; done: Promise<void> }
```
Job body (async):
1. `plan = getPlan(db, planId)`; `settings = getSettings(db)`; `oldMeals = plan.meals`.
2. `cutoff = { day: cutoffDay, slot: cutoffSlot }`; `{ frozen, adjustable } = partitionMeals(oldMeals, cutoff)`.
3. `result = await curator.adjustWeek({ settings, note, frozenMeals: frozen, futureMeals: adjustable, onHand: plan.onHand })`.
4. `saveSnapshot(db, planId, { note, cutoffDay, cutoffSlot, meals: oldMeals, shopping: getShoppingItems(db, planId) })`.
5. Apply change set (ADJUSTABLE cells only — skip+log any change/removal whose cell is frozen):
   - `byCell = Map(adjustable, m => \`${m.day}:${m.slot}\`)`; `servings = householdServings(settings.household)`.
   - removals: `deleteMeal(db, m.id)` and `byCell.delete(key)`.
   - changes: existing cell → `updateMeal(db, existing.id, scaleRawMeal(change, servings))`; else `addMeal(db, planId, scaleRawMeal(change, servings))`. (`scaleRawMeal` — extract the copy in `routes/plans.ts` into `domain/portions.ts` as `scaleRawMeal(raw, servings)` and import in both places; Task 8a.)
6. `updated = getPlan(db, planId)`.
7. Shopping (shared mapping for a correct diff):
   - `rawOld = buildShoppingList(oldMeals)`, `rawNew = buildShoppingList(updated.meals)`.
   - `mapping = await curator.consolidateShopping([...unique names of rawOld+rawNew])` wrapped so failure → identity (reuse `consolidateShopping` from llm/consolidation on the union? simpler: call `curator.consolidateShopping` directly in try/catch, fall back to `[]`).
   - `oldBuy = excludeOnHand(consolidateShoppingList(rawOld, mapping), plan.onHand).toBuy`.
   - `newBuy = excludeOnHand(consolidateShoppingList(rawNew, mapping), plan.onHand).toBuy`.
   - `saveShoppingItems(db, planId, newBuy)`.
   - `delta = shoppingDelta(oldBuy, newBuy)`.
8. `store.markDone(job.id, planId, delta)`. On error: `store.markError(job.id, message)`.

Return `{ jobId: job.id, done }` (done awaited only in tests).

- [ ] **Task 8a first:** extract `scaleRawMeal` to `domain/portions.ts`, update `routes/plans.ts`
  import, run existing plans route tests → PASS, commit `refactor(server): share scaleRawMeal`.
- [ ] Test (8): fake curator returns a change set replacing Thu dinner + removing Fri dinner;
  with a Wed-cutoff plan → after `done`: frozen Mon meals untouched (same id/rating), Thu dinner
  changed, Fri dinner gone, job `result.toBuy`/`leftover` populated. Run → FAIL → implement → PASS.
- [ ] Commit `feat(server): mid-week adjustment job`.

## Task 9: Route — POST /plans/:id/adjust + GET /plans/:id/snapshots

**Files:**
- Modify: `server/src/routes/plans.ts`
- Test: `server/test/routes/plans.test.ts`

`POST /plans/:id/adjust`:
- 404 if plan missing; 409 if `plan.status !== "active"`.
- Body `{ note?, cutoffDay, cutoffSlot }`: `note` defaults `""`; `cutoffDay` int 0–6;
  `cutoffSlot` in `SLOTS` → else 400.
- `enqueueAdjustment({db, curator: deps.curator, store: deps.store}, { planId, weekStart: plan.weekStart, note, cutoffDay, cutoffSlot })` → `202 { jobId }`.

`GET /plans/:id/snapshots` → `listSnapshots(db, id)` (200, array).

- [ ] Test: bad cutoff → 400; non-active plan → 409; happy path → 202 + jobId, and after the
  fake job settles the snapshot is listable. Update the test's fake `PlanCurator` to add
  `adjustWeek`. Run → FAIL → implement → PASS. Commit `feat(server): adjust + snapshots routes`.

## Task 10: Client API + types

**Files:**
- Modify: `client/src/types.ts`, `client/src/api/client.ts`

**Produces:**
- types: `ShoppingDelta = { toBuy: ShoppingItem[]; leftover: ShoppingItem[] }`; extend `Job`
  with `result?: ShoppingDelta | null`; `AdjustInput = { note: string; cutoffDay: number; cutoffSlot: Slot }`;
  `PlanSnapshot = { id: number; note: string; cutoffDay: number; cutoffSlot: Slot; createdAt: string; meals: Meal[]; shopping: ShoppingItem[] }`.
- client: `adjustWeek(planId: number, input: AdjustInput): Promise<{ jobId: string }>` (POST);
  `listSnapshots(planId: number): Promise<PlanSnapshot[]>` (GET).
- [ ] Commit `feat(client): adjust API + delta types` (no test — thin wrappers, covered by usage).

## Task 11: Client — default cutoff helper (pure, tested)

**Files:**
- Modify: `client/src/lib/weeks.ts`
- Test: `client/src/lib/weeks.test.ts` (create)

**Produces:**
```ts
export function defaultCutoff(today: Date, weekStart: string): { day: number; slot: Slot }
```
- Day index = whole days from `weekStart` (Monday) to `today`, clamped 0–6. Before the week → `{0,"breakfast"}`.
- Slot by local hour: `<9 breakfast, <11 morning_snack, <14 lunch, <17 afternoon_snack, else dinner`.
  (Documented default; easy to tune later.)
- [ ] Test: Wed 15:00 of the week → `{2,"afternoon_snack"}`; a date before weekStart → `{0,"breakfast"}`.
  Run `npm -w client test -- weeks` → FAIL → implement → PASS. Commit.

## Task 12: Client — AdjustWeekForm

**Files:**
- Create: `client/src/components/AdjustWeekForm.tsx`, `.css`
- Modify: `client/src/pages/Dashboard.tsx`

**Produces:** `<AdjustWeekForm plan onSubmit={(input:AdjustInput)=>void} onCancel submitting />`.
- Pre-fills cutoff from `defaultCutoff(new Date(), plan.weekStart)`; day `<select>` (Mon–Sun)
  + slot `<select>` (SLOT_LABELS); note `<textarea>` with placeholder example; submit disabled
  while `submitting` or note empty.
- Dashboard: add an **"Adjust this week"** button next to "New week", shown only when
  `bundle.plan.status === "active"`; toggles `showAdjust`. `handleAdjust(input)` calls
  `adjustWeek(plan.id, input)` then `setActiveJob({id, startedAt})` (reuses GeneratingPanel + poll).
- [ ] Commit `feat(client): adjust-week form + entry point`.

## Task 13: Client — show the delta + version history

**Files:**
- Create: `client/src/components/WhatChanged.tsx`, `.css`
- Modify: `client/src/pages/Dashboard.tsx`

- Extend the poll's `done` branch: when `job.result` is present, `setDelta(job.result)`.
- Render `<WhatChanged delta units onDismiss />` above the WeekGrid when `delta` is set:
  a **To buy** list and a **Leftover / no longer needed** list (reuse quantity formatting from
  `lib/quantity`). Empty sides show "nothing".
- Version history: a collapsible "Previous versions (N)" section that lazy-loads
  `listSnapshots(plan.id)` and lists each snapshot's `createdAt`, `note`, and meal-title
  summary (read-only). Shown only when `status === "active"`.
- [ ] Commit `feat(client): what-changed delta + version history`.

## Task 14: Verify end-to-end

- [ ] `npm -w server test` → all pass.
- [ ] `npm -w client test` → all pass.
- [ ] `npm -w server run typecheck` and `npm -w client run build` (tsc) → clean.
- [ ] Invoke the `verify` skill / run the app: generate or load an active week, adjust it with a
  note, confirm frozen meals unchanged, changed meals updated, delta + snapshot appear.
- [ ] Commit any fixes; open PR.

## Spec coverage self-check

Cutoff auto+override → T11/T12. Surgical change set → T4/T5/T6/T8. Frozen never repeated/changed
→ T5 prompt + T8 guard. Two-sided delta → T2/T8/T13. Snapshot each time → T3/T8/T13. Background
job → T7/T8/T9/T12. All spec sections map to a task.
