# Mid-week plan adjustment — design

## Problem

Today the app supports two regeneration modes: full-week generation (a background
job) and single-meal regeneration (synchronous). Neither lets a household **adjust
the current week partway through it** while treating the meals already eaten as
fixed history.

We want: while a week is in progress, the user gives a directional note (e.g.
"we're eating out Thursday, more veg the rest of the week, use up the spinach") and
the app re-plans **only the remaining meals** to match — without repeating the meals
already eaten, and without touching them.

## Goals

- Freeze the past portion of the current week; re-plan the future portion only.
- Let a free-text directional note steer the remaining meals **surgically** — change
  only what the note implies, keep everything else exactly as it was.
- Never repeat the meals already eaten this week.
- Show a two-sided shopping **delta**: new things to buy, and already-bought items
  now left over.
- Keep a **snapshot** of the plan before each adjustment (an audit trail of what the
  week was).

## Non-goals

- Re-rolling meals the user hasn't chosen to change (no full future re-emit).
- Editing weeks other than the active/current one.
- Reconciling `checked` shopping state across adjustments (the delta is the actionable
  view; the stored list is recomputed for the whole week).

## Guiding principle

Consistent with the existing codebase: **the LLM curates, the code computes.** The
LLM decides *which* future meals the note implies changing and returns real recipes;
deterministic code does the freezing, portion scaling, change-set application, and the
shopping-delta arithmetic. The model is never trusted for quantity math or set logic.

## Design decisions (from brainstorming)

1. **Past/future split** — auto-derived from the current date *and time of day*, with
   a user-adjustable override.
2. **Re-plan scope** — the note decides **surgically**; untouched meals stay identical.
3. **Shopping list** — show a two-sided delta (buy + leftover), not a full recompute in
   the UI.
4. **Persistence** — keep a **snapshot** of the pre-adjustment plan on every adjustment.
5. **Execution** — runs as a **background job**, like full generation.

## Architecture

### Data model

One new table; the live plan stays a single active row.

```sql
CREATE TABLE IF NOT EXISTS plan_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id       INTEGER NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  note          TEXT NOT NULL DEFAULT '',   -- directional note that triggered the adjustment
  cutoff_day    INTEGER NOT NULL,           -- freeze boundary (0–6) at adjust time
  cutoff_slot   TEXT NOT NULL,              -- freeze boundary slot
  plan_json     TEXT NOT NULL,              -- full pre-adjustment plan (meals) as JSON
  shopping_json TEXT NOT NULL,              -- full pre-adjustment shopping list as JSON
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

A snapshot captures the plan **before** each adjustment is applied. Repeated
adjustments stack as ordered rows.

### The cutoff (past/future boundary)

A single `(day, slot)` pair using the existing slot ordering
(`breakfast=0 … dinner=4`). Everything strictly *before* it is **frozen**; the cutoff
and everything after is **adjustable**. A global ordinal `day * 10 + slotOrder[slot]`
makes "at or after the cutoff" a single comparison.

- The **client** derives a default from `now` vs `weekStart`: today's weekday → day
  index, and time of day → the first still-upcoming slot (mid-afternoon ⇒
  breakfast/morning-snack/lunch frozen, afternoon-snack/dinner open). A pure helper in
  `client/src/lib/weeks.ts`, unit-tested.
- The user can nudge the boundary in the UI. The chosen cutoff is sent explicitly to
  the server, which validates (day 0–6, valid slot) and trusts it.

### Endpoint + background job

`POST /plans/:id/adjust` with body `{ note, cutoffDay, cutoffSlot }`:

1. Validate: plan exists, is the active week, cutoff is well-formed. `400/404/409` on
   failure (synchronously, before any job is created), matching the generate route.
2. **Snapshot** the current plan (meals + shopping) into `plan_snapshots`.
3. Enqueue an adjust job (reusing `JobStore`); return `202 { jobId }`.
4. The client polls `GET /api/jobs/:id`, exactly like today's generation flow.

The completed job carries the shopping **delta** so the client can display it: the job
result is extended to hold `{ toBuy, leftover }` alongside `planId`.

### LLM change-set (the "curate" half)

New `buildAdjustPrompt` + `curator.adjustWeek(...)`, reusing the existing
settings/measurement/protein helpers. The prompt provides:

- **Frozen meals** — "already eaten this week — do NOT repeat these and do NOT change
  them" (titles per day/slot).
- **Current future meals** — the plan for the rest of the week (day, slot, title,
  proteinClass, base).
- **The directional note** — "apply this to the rest of the week."

It returns a strict, schema-validated **change set** — not the whole week:

```
AdjustResult = {
  changes:  RawMeal[]            // replacement meals for specific (day, slot) cells
  removals: { day, slot }[]      // cells to clear entirely (e.g. eating out)
}
```

Instructions require it to preserve protein balance and variety, respect standing
constraints (avoid-list, diet, effort, portions), and fix dependent leftovers (change a
dinner ⇒ update any lunch that reused it). Real recipes via web search, per-serving
quantities, shopping categories — same requirements as the existing prompts.

### Applying the change set + shopping delta (the "compute" half)

Deterministic code:

- Frozen meals and untouched future meals stay **byte-for-byte identical**.
- `changes` upsert their `(day, slot)` cell (portion-scaled via `scaleRawMeal`);
  `removals` delete theirs.
- **Frozen guard**: any change or removal targeting a cell strictly before the cutoff is
  **rejected** — the invariant that keeps the past immutable.
- **Delta**: build the consolidated, on-hand-excluded buy-list for the old plan and the
  new plan, then diff per `(canonical name, unit)`:
  - `toBuy` = quantity increases → *new things to buy*
  - `leftover` = quantity decreases → *already-bought surplus no longer needed*

  To keep canonical names aligned across the two lists for a correct diff, consolidate
  the union of names once and apply the same mapping to both sides.
- The plan's stored shopping list is replaced with the new full-week buy-list;
  `{ toBuy, leftover }` is returned for display only.

### Client UX

- An **"Adjust this week"** action shown only on the *active* week (not history).
  Opens a panel with the auto-derived cutoff (editable), a directional-note textarea,
  and submit.
- Submit reuses the `GeneratingPanel` polling. On completion it refetches the plan,
  highlights the changed meal cards, and shows a **"What changed"** delta: a *To buy*
  list and a *Leftover / no longer needed* list.
- A lightweight **version history** on the plan ("Adjusted 2×") lists prior snapshots
  with their triggering note + timestamp, each viewable read-only.

## Testing

Matching the existing test layout (`server/test/**`, `client` unit tests):

- **Domain (pure):** cutoff helper (date + time → cutoff); shopping-delta math
  (buy/leftover, unit alignment, on-hand exclusion, canonical alignment); change-set
  application (upsert/remove) + frozen-guard rejection.
- **Prompt:** `buildAdjustPrompt` includes frozen titles as don't-repeat, the note, and
  the adjustable cells.
- **Schema:** `AdjustResult` validation (well-formed and malformed inputs).
- **Route:** `POST /plans/:id/adjust` with a fake curator returning a change set →
  asserts snapshot saved, future meals changed, frozen meals untouched, delta returned;
  plus validation failures (missing/invalid cutoff, non-active plan).
- **Job:** `enqueueAdjustment` success and error paths.

## Open risks

- A long note that changes many meals makes the job slower (multiple web searches). The
  background-job model absorbs this; no request timeout.
- Leftover accounting is informational — it reflects buy-list quantity reductions, not a
  reconciliation against what was physically purchased/checked.
