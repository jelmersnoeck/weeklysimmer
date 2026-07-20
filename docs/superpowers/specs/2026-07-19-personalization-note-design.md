# Personalization note — design

## Problem

The app captures household preferences through structured controls (household members,
protein frequencies, liked cuisines/flavours, avoids, diets, units, effort). Structured
controls can't express everything a household wants to say: seasonal steers ("go easy on
red meat this month"), cooking constraints ("we only cook one pot on weeknights"), or
taste nuance the fixed lists don't cover.

We want a single free-text field the user maintains in their own words that is injected
into **every** planning session, so they can fine-tune the planner's behaviour in natural
language without waiting for new structured settings.

## Goals

- One free-text "personalization note" stored alongside the household settings.
- Injected into every LLM call that produces meals: full-week generation, single-meal
  regeneration, and mid-week adjustment.
- Framed to the model as the **highest-priority** instruction — it overrides every
  structured preference, diet, and exclude when they conflict.
- Zero behaviour change for users who leave it empty (prompt stays byte-identical).

## Non-goals

- Injecting the note into the shopping-list consolidation review (not a planning
  session — it only maps ingredient names to canonical products).
- Structured parsing of the note, multiple notes, or per-week override of the note (the
  existing per-week `note` already covers this-week specifics).
- A DB migration — settings are a single JSON blob and the field backfills.

## Design decisions (from brainstorming)

1. **Priority** — the note is **top authority**: it can override anything, including the
   hard avoid-list and diets. This is a local, single-household tool with the user's own
   API key, so maximum natural-language control is the point. The UI makes the precedence
   (and the responsibility) explicit.
2. **Scope** — injected into **all three** meal-planning prompts: `buildCurationPrompt`,
   `buildRegeneratePrompt`, `buildAdjustPrompt`. Not the consolidation prompt.
3. **Shape** — a single free-text field, not structured sub-fields.
4. **Field name** — `personalNote` (distinct from the per-week `note`). UI label
   "Personalisation".
5. **Length cap** — 2000 characters, trimmed, to bound token cost.

## Guiding principle

Consistent with the codebase: **the LLM curates, the code computes.** The note only
influences *which* recipes the model chooses; all deterministic work (portion scaling,
shopping-list math) is unchanged. The note is never trusted for arithmetic.

## Architecture

### Data model (`server/src/domain/types.ts`)

Add one field to `Settings`:

```ts
personalNote: string; // free-text standing instructions; "" when unset
```

### Persistence (`server/src/db/settingsRepo.ts`)

No structural change. `getSettings` already merges the stored blob over
`defaultSettings()`, so any existing row that predates this field backfills to
`personalNote: ""` automatically. `saveSettings` stores it via the existing spread. No
DB migration.

### Defaults (`server/src/domain/preferences.ts`)

`defaultSettings()` returns `personalNote: ""`.

### Validation (`server/src/domain/settingsValidation.ts`)

- Accept `personalNote` as an **optional** field.
- If present, it must be a string (else 400, consistent with other fields).
- Normalise: `trim()`, then cap to 2000 characters (`slice(0, 2000)`).
- Missing / `undefined` → `""`.
- Include `personalNote` in the returned `Settings`.

### Prompt injection (`server/src/llm/prompt.ts`)

A single shared helper renders the note block, or `""` when the note is empty:

```
## Household instructions (HIGHEST PRIORITY — these override everything below)
The household gave these standing instructions in their own words. They take precedence
over every preference, diet, and exclude listed later in this prompt — where anything
conflicts, THESE WIN:
"""
<personalNote>
"""
```

- Rendered near the **top** of `buildCurationPrompt`, `buildRegeneratePrompt`, and
  `buildAdjustPrompt`, right after the intro line and before the structured sections.
- When `personalNote` is `""`, the helper returns `""` and the section is omitted
  entirely — prompts for users without a note are byte-identical to today.
- Precedence vs. the existing per-week `note` / adjust note: both are authoritative;
  the standing note is described as always-on personalization, the per-week note as
  specifics for *this* week. They rarely conflict; when they do for a given week, the
  this-week note wins. No special prompt logic is needed beyond labelling each clearly.

### API type (`client/src/api/client.ts`)

Add `personalNote: string` to the client-side settings type so it round-trips through the
GET/PUT settings calls.

### UI (`client/src/pages/Settings.tsx`)

- A prominent `<textarea>` near the **top** of the Settings page.
- Label: **"Personalisation"**.
- Caption: *"Standing instructions in your own words, applied to every plan. These take
  precedence over everything else — including your avoids and diets."*
- Wired into the existing settings state and the PUT save flow.

## Data flow

1. User types into the Personalisation textarea → saved via `PUT /api/settings`.
2. `validateSettings` trims + caps → `saveSettings` persists the blob.
3. A planning job (`generation.ts` / `adjustment.ts`) or the regenerate route reads
   settings via `getSettings` and calls a `build*Prompt` function.
4. The prompt helper injects the note block at the top when non-empty.
5. The LLM curates recipes honouring the note above all else; deterministic code scales
   portions and builds the shopping list unchanged.

## Error handling

- Non-string `personalNote` → `validateSettings` returns `{ ok: false, error }` → route
  answers 400, matching existing field behaviour.
- Over-length note is silently truncated to 2000 chars (not an error) so a long paste is
  never rejected outright.
- Empty/whitespace-only note → `""` → no prompt section, no behavioural effect.

## Testing

- **Prompt unit tests** (`server/`): shared helper renders the block when set and returns
  `""` when empty; each of the three `build*Prompt` functions includes the note text when
  present and omits the section when absent.
- **Validation tests**: trims surrounding whitespace, caps at 2000 chars, coerces
  missing → `""`, rejects a non-string with an error.
- **Settings repo**: a stored blob without `personalNote` reads back as `""`; a saved
  note round-trips.
- **Client test** (`client/test/pages/Settings.test.tsx`): the textarea renders and a
  typed value is included in the saved payload.
