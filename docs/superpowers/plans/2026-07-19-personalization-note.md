# Personalization Note Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single free-text "personalization note" to household settings that is injected as the highest-priority instruction into every meal-planning LLM prompt.

**Architecture:** One new `personalNote: string` field on the `Settings` JSON blob (server + client types, no DB migration). Validation trims and caps it. A shared prompt helper renders a top-priority note block into all three `build*Prompt` functions, or nothing when the note is empty. A textarea in the Settings page edits it.

**Tech Stack:** TypeScript, Node + better-sqlite3 + Express (server), React + Vite (client), Vitest + Testing Library (tests).

## Global Constraints

- Field name is exactly `personalNote` (distinct from the per-week `note`). Verbatim.
- UI label is exactly **"Personalisation"** (British spelling, matching "flavours"). Verbatim.
- Length cap: **2000 characters**, applied after `trim()`.
- The note is framed to the LLM as **HIGHEST PRIORITY**, overriding every structured preference, diet, and exclude.
- When `personalNote` is `""`, every prompt must be **byte-identical** to today (section omitted entirely).
- Server tests run with `npm test` (aka `vitest run`) from `server/`. Client tests run with `npm test` from `client/`.
- Follow TDD: failing test first, minimal implementation, green, commit.

---

### Task 1: Persist `personalNote` (server type, default, validation)

Adds the field to the server `Settings` type, defaults it to `""`, and validates it on `PUT /api/settings` (trim + 2000-char cap + non-string rejection). Also verifies the repo backfills old rows via its existing merge-over-defaults read.

**Files:**
- Modify: `server/src/domain/types.ts` (add field to `Settings`)
- Modify: `server/src/domain/preferences.ts` (`defaultSettings()` returns `personalNote: ""`)
- Modify: `server/src/domain/settingsValidation.ts` (accept/normalise/return `personalNote`)
- Test: `server/test/domain/settingsValidation.test.ts`
- Test: `server/test/db/settingsRepo.test.ts`

**Interfaces:**
- Produces: `Settings.personalNote: string` — consumed by Task 2 (prompt) and Task 3 (client mirrors the type).
- Consumes: existing `makeSettings(overrides)` test helper (`server/test/helpers/settings.ts`), which spreads `defaultSettings()` so it automatically gains `personalNote: ""`.

- [ ] **Step 1: Write the failing validation tests**

Add these tests inside the existing `describe("validateSettings", ...)` block in `server/test/domain/settingsValidation.test.ts`:

```ts
it("defaults a missing personalNote to an empty string", () => {
  const { personalNote, ...withoutNote } = makeSettings();
  const result = validateSettings(withoutNote);
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.settings.personalNote).toBe("");
});

it("trims and keeps a provided personalNote", () => {
  const result = validateSettings(
    makeSettings({ personalNote: "  no pork, love one-pot meals  " }),
  );
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.settings.personalNote).toBe("no pork, love one-pot meals");
  }
});

it("caps personalNote at 2000 characters", () => {
  const result = validateSettings(makeSettings({ personalNote: "a".repeat(2500) }));
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.settings.personalNote).toHaveLength(2000);
});

it("rejects a non-string personalNote", () => {
  const result = validateSettings(makeSettings({ personalNote: 42 as never }));
  expect(result.ok).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npm test -- settingsValidation`
Expected: FAIL — `personalNote` is not on `Settings` yet (TypeScript error) and/or the field is missing from the validated result.

- [ ] **Step 3: Add the field to the `Settings` type**

In `server/src/domain/types.ts`, inside the `Settings` interface, add the field after `effort` (before `mealSchedule`):

```ts
  effort: Difficulty;
  /** Free-text standing instructions applied to every plan; "" when unset. Highest priority. */
  personalNote: string;
  mealSchedule: MealSchedule;
```

- [ ] **Step 4: Default the field**

In `server/src/domain/preferences.ts`, inside the object returned by `defaultSettings()`, add after `effort: "easy",`:

```ts
    effort: "easy",
    personalNote: "",
    mealSchedule: defaultMealSchedule(),
```

- [ ] **Step 5: Validate and return the field**

In `server/src/domain/settingsValidation.ts`, inside `validateSettings`, add this block after the `effort` check (the `if (!EFFORTS.includes(...))` block) and before `const mealSchedule = validateMealSchedule(...)`:

```ts
  // personalNote: optional free-text standing instructions. Trim, then cap length
  // to bound token cost. Missing → "". Non-string is a hard 400.
  let personalNote = "";
  if (b.personalNote !== undefined) {
    if (typeof b.personalNote !== "string") {
      return { ok: false, error: "personalNote must be a string" };
    }
    personalNote = b.personalNote.trim().slice(0, 2000);
  }
```

Then add `personalNote,` to the returned `settings` object, after `effort: b.effort as Difficulty,`:

```ts
      effort: b.effort as Difficulty,
      personalNote,
      mealSchedule,
```

- [ ] **Step 6: Run the validation tests to verify they pass**

Run: `cd server && npm test -- settingsValidation`
Expected: PASS (all four new tests plus the existing ones).

- [ ] **Step 7: Write the failing repo backfill test**

Add this test inside the `describe("getSettings", ...)` block in `server/test/db/settingsRepo.test.ts`:

```ts
it("backfills personalNote to '' for a v2 row saved before the field existed", () => {
  const db = openDb(":memory:");
  const { personalNote, ...withoutNote } = makeSettings();
  db.prepare("INSERT OR REPLACE INTO settings (id, data) VALUES (1, ?)").run(
    JSON.stringify(withoutNote),
  );
  const settings = getSettings(db);
  expect(settings.configured).toBe(true);
  expect(settings.personalNote).toBe("");
  db.close();
});

it("round-trips a saved personalNote", () => {
  const db = openDb(":memory:");
  saveSettings(db, makeSettings({ personalNote: "budget-friendly, batch cook" }));
  expect(getSettings(db).personalNote).toBe("budget-friendly, batch cook");
  db.close();
});
```

- [ ] **Step 8: Run the repo tests to verify they pass**

Run: `cd server && npm test -- settingsRepo`
Expected: PASS. `getSettings` already merges the stored blob over `defaultSettings()`, so the missing field backfills to `""` with no code change; the round-trip works through the existing spread.

- [ ] **Step 9: Typecheck and run the full server suite**

Run: `cd server && npm run typecheck && npm test`
Expected: PASS (no other Settings construction sites break — `makeSettings` and `defaultSettings` both now provide the field).

- [ ] **Step 10: Commit**

```bash
git add server/src/domain/types.ts server/src/domain/preferences.ts server/src/domain/settingsValidation.ts server/test/domain/settingsValidation.test.ts server/test/db/settingsRepo.test.ts
git commit -m "feat(settings): persist and validate personalNote field"
```

---

### Task 2: Inject the note into all three planning prompts

Adds a shared helper that renders the top-priority note block (or `""`) and threads it into `buildCurationPrompt`, `buildRegeneratePrompt`, and `buildAdjustPrompt`. Not the consolidation prompt.

**Files:**
- Modify: `server/src/llm/prompt.ts`
- Test: `server/test/llm/prompt.test.ts`

**Interfaces:**
- Consumes: `Settings.personalNote` (from Task 1); each `build*Prompt` already destructures `settings` from its input.
- Produces: no new exported symbol — the helper is module-private. Prompt output gains a `## Household instructions (HIGHEST PRIORITY ...)` section when the note is set.

- [ ] **Step 1: Write the failing prompt tests**

Add this `describe` block to `server/test/llm/prompt.test.ts` (it already imports the three builders, `makeSettings`, `defaultMealSchedule`, `enabledSlotsFromSchedule`, and `Meal`):

```ts
describe("personalNote injection", () => {
  const NOTE = "We only cook one pot on weeknights and avoid all pork.";
  const noted = makeSettings({ personalNote: NOTE });

  const curation = buildCurationPrompt({ ...input, settings: noted });
  const regenerate = buildRegeneratePrompt({
    settings: noted,
    day: 1,
    slot: "dinner",
    proteinClass: "lean",
    onHand: [],
    note: "",
    otherMeals: [] as Meal[],
  });
  const adjust = buildAdjustPrompt({
    settings: noted,
    note: "",
    scope: { kind: "days", days: [2] },
    fixedMeals: [] as Meal[],
    adjustableMeals: [] as Meal[],
    onHand: [],
  });

  it("puts the note as a HIGHEST PRIORITY block in all three planning prompts", () => {
    for (const prompt of [curation, regenerate, adjust]) {
      expect(prompt).toContain(NOTE);
      expect(prompt.toUpperCase()).toContain("HIGHEST PRIORITY");
    }
  });

  it("omits the note section entirely when personalNote is empty", () => {
    const plain = buildCurationPrompt(input); // input.settings has personalNote ""
    expect(plain.toUpperCase()).not.toContain("HIGHEST PRIORITY");
    expect(plain).not.toContain("Household instructions");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd server && npm test -- prompt`
Expected: FAIL — the "HIGHEST PRIORITY" block is not rendered yet.

- [ ] **Step 3: Add the shared helper**

In `server/src/llm/prompt.ts`, add this function just above `buildCurationPrompt` (after the `proteinProfile` helper):

```ts
/**
 * Render the household's standing free-text instructions as a top-priority prompt
 * block, or "" when unset so the section is omitted entirely (keeping note-less
 * prompts byte-identical). Framed as HIGHEST priority: it overrides every structured
 * preference, diet, and exclude that follows.
 */
function personalNoteSection(settings: Settings): string {
  const note = settings.personalNote?.trim();
  if (!note) return "";
  return `## Household instructions (HIGHEST PRIORITY — these override everything below)
The household gave these standing instructions in their own words. They take precedence
over every preference, diet, and exclude listed later in this prompt — where anything
conflicts, THESE WIN:
"""
${note}
"""

`;
}
```

- [ ] **Step 4: Inject into `buildCurationPrompt`**

In `buildCurationPrompt`, add a local right after the existing destructure/derived vars (e.g. after `const servings = householdServings(settings.household);`):

```ts
  const noteSection = personalNoteSection(settings);
```

Then, in the returned template literal, change the blank line before `You are ONLY responsible` so the section is inserted there. Find:

```ts
User note for this week: ${note}

You are ONLY responsible for choosing REAL recipes and returning them as structured
```

and replace with:

```ts
User note for this week: ${note}

${noteSection}You are ONLY responsible for choosing REAL recipes and returning them as structured
```

(When `noteSection` is `""`, this is byte-identical to the original.)

- [ ] **Step 5: Inject into `buildRegeneratePrompt`**

In `buildRegeneratePrompt`, add after the existing derived vars (e.g. after `const dietLine = ...`):

```ts
  const noteSection = personalNoteSection(settings);
```

Then find:

```ts
existing weekly plan and return it as a single structured meal.

## Target slot
```

and replace with:

```ts
existing weekly plan and return it as a single structured meal.

${noteSection}## Target slot
```

- [ ] **Step 6: Inject into `buildAdjustPrompt`**

In `buildAdjustPrompt`, add after the existing derived vars (e.g. after the `dietLine` const):

```ts
  const noteSection = personalNoteSection(settings);
```

Then find:

```ts
  return `You are a meal-prep planner for a family household. ${scopeIntro}

## What the household is asking for (apply this to the meals you may change)
```

and replace with:

```ts
  return `You are a meal-prep planner for a family household. ${scopeIntro}

${noteSection}## What the household is asking for (apply this to the meals you may change)
```

- [ ] **Step 7: Run the prompt tests to verify they pass**

Run: `cd server && npm test -- prompt`
Expected: PASS (new block present when set, absent when empty; existing prompt assertions still pass).

- [ ] **Step 8: Typecheck and run the full server suite**

Run: `cd server && npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add server/src/llm/prompt.ts server/test/llm/prompt.test.ts
git commit -m "feat(prompt): inject personalNote as highest-priority instruction into planning prompts"
```

---

### Task 3: Client — type mirror and Settings UI

Adds `personalNote` to the client `Settings` type and a prominent "Personalisation" textarea at the top of the Settings page, wired into the existing save flow.

**Files:**
- Modify: `client/src/types.ts` (add field to `Settings`)
- Modify: `client/src/pages/Settings.tsx` (textarea + handler)
- Test: `client/test/pages/Settings.test.tsx`

**Interfaces:**
- Consumes: server `Settings.personalNote` via `getSettings()` / `updateSettings()` (already typed through `client/src/types.ts`).
- Produces: a `<textarea aria-label="Personalisation">` bound to `draft.personalNote`, included in the `updateSettings(draft)` payload.

- [ ] **Step 1: Write the failing client test**

In `client/test/pages/Settings.test.tsx`, first add `personalNote: ""` to the local `makeSettings` factory's returned object (after `effort: "medium",`) so it satisfies the updated type:

```ts
    effort: "medium",
    personalNote: "",
```

Then add this test (mirror the existing render + save pattern used by the other tests in the file — inspect a neighbouring test for the exact `render`/mock/`onSaved` setup and reuse it):

```ts
test("edits and saves the personalisation note", async () => {
  const user = userEvent.setup();
  vi.mocked(api.updateSettings).mockResolvedValue({
    settings: makeSettings({ personalNote: "no pork, one-pot only" }),
    conflicts: [],
  });
  render(
    <SettingsScreen
      initial={makeSettings()}
      options={options}
      mode="edit"
      onSaved={() => {}}
    />,
  );

  const box = screen.getByLabelText("Personalisation");
  await user.type(box, "no pork, one-pot only");
  await user.click(screen.getByRole("button", { name: /save/i }));

  await waitFor(() => expect(api.updateSettings).toHaveBeenCalled());
  const sent = vi.mocked(api.updateSettings).mock.calls[0][0];
  expect(sent.personalNote).toBe("no pork, one-pot only");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd client && npm test -- Settings`
Expected: FAIL — no element with label "Personalisation" exists yet (and a TS error until the type is updated).

- [ ] **Step 3: Add the field to the client `Settings` type**

In `client/src/types.ts`, inside the `Settings` interface, add after `effort: ...` and before the `mealSchedule` comment:

```ts
  effort: "easy" | "medium" | "hard";
  /** Free-text standing instructions applied to every plan; "" when unset. */
  personalNote: string;
  // Which meals to plan per slot; NOT edited on the settings screen — carried through as-is.
  mealSchedule: MealSchedule;
```

- [ ] **Step 4: Add the Personalisation section to the UI**

In `client/src/pages/Settings.tsx`, insert this section immediately after the `settings__intro` div (before the `{/* Household */}` section) so it sits at the top:

```tsx
      {/* Personalisation */}
      <section className="settings__section" aria-labelledby="set-personal">
        <h3 className="settings__section-title" id="set-personal">
          Personalisation
        </h3>
        <p className="settings__hint">
          Standing instructions in your own words, applied to every plan. These take
          precedence over everything else — including your avoids and diets.
        </p>
        <textarea
          className="settings__personal-note"
          aria-label="Personalisation"
          rows={4}
          maxLength={2000}
          placeholder="e.g. We only cook one pot on weeknights, love bold flavours, and are trying to eat less red meat this month."
          value={draft.personalNote ?? ""}
          onChange={(e) => patch({ personalNote: e.target.value })}
        />
      </section>
```

- [ ] **Step 5: Run the client test to verify it passes**

Run: `cd client && npm test -- Settings`
Expected: PASS.

- [ ] **Step 6: Typecheck and run the full client suite**

Run: `cd client && npm run typecheck && npm test`
Expected: PASS. (If `client` has no `typecheck` script, run `npx tsc --noEmit` instead.)

- [ ] **Step 7: Commit**

```bash
git add client/src/types.ts client/src/pages/Settings.tsx client/test/pages/Settings.test.tsx
git commit -m "feat(settings-ui): add Personalisation note textarea"
```

---

## Notes for the implementer

- **No DB migration.** `getSettings` merges the stored blob over `defaultSettings()`, so pre-existing rows read back `personalNote: ""` automatically (verified in Task 1, Step 7).
- **Byte-identical when empty** is a real requirement — the `${noteSection}` splices in Task 2 are placed exactly where an empty string reproduces today's prompt. Don't add surrounding whitespace.
- **Styling** (`settings__personal-note`) is optional; the tasks pass without a CSS rule. If you add one, put it in the Settings page's stylesheet alongside the other `settings__*` rules; it doesn't need its own task.
