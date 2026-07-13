# Weekly Simmer

Weekly Simmer plans a full week of meals for your household and turns it into a
consolidated shopping list. You configure your food preferences once; each week you say
what you already have and which meals you want, and Claude (Opus 4.8, with web search)
curates real, source-linked recipes that fit your household — respecting your diets,
allergies/avoids, proteins, cuisines, flavours, portion sizes, and effort level. The app
then does all the deterministic work: scaling portions, timing, calories, merging the
shopping list, and dropping anything you already have.

It runs locally (React + a small Node/SQLite backend that holds your Claude API key).

## What it does

- **Preference-driven.** A one-time setup captures your **household** (adults / children /
  toddlers / babies, each with an appetite that sets portion size), **protein
  frequencies**, liked **vegetables / fruits / cuisines / dish types / flavours**,
  **avoids** (dairy, lactose, gluten, nuts, shellfish, …), and **diets** you follow
  (Vegetarian / Vegan / Pescatarian / Low-FODMAP — pick any combination). Conflicting
  choices (e.g. Vegan + eggs) are kept but flagged.
- **A full day, five slots.** Breakfast, a morning snack, lunch, an afternoon snack, and
  dinner — for each day you enable. A per-week **meal map** lets you toggle any cell, day,
  or meal type on/off.
- **Built around what you have.** Enter the foods you already have to use up; meals are
  planned to use them (and marked "Uses your …"), and those foods are left off the
  shopping list.
- **Smart leftovers & shared bases.** Dinners are the cooked meals; lunches reuse them.
  Rice, etc. are shared across the week to cut waste.
- **Real recipes.** Claude searches the web and returns complete recipes with ingredients,
  steps, times (prep + cook), per-serving calories, and a source link.
- **A shopping list that's actually usable.** Ingredients are portion-scaled and merged;
  an LLM review folds same-product lines together (e.g. *cooked rice* + *jasmine rice* →
  *rice*, but *brown rice* stays separate); shelf-stable bulk items (rice, pasta, oats,
  butter, tinned goods) get their own **Bulk staples** aisle; quantities show in metric,
  US cups, or both. **Copy** it as a flat list or send it to **Apple Reminders**.
- **History & ratings.** Past weeks are saved; rate meals to steer variety.
- **Runs in the background.** Generation is a background job (it takes a few minutes with
  web search), so you can close the tab and come back — the plan is saved when it's done.

## How it works

Three layers. Your Claude API key stays server-side (never in the browser).

- **client/** — React + Vite dashboard. Talks only to `/api`.
- **server/** — Express + SQLite. Owns the API key, runs generation as a background job,
  and does all the deterministic math.
- **Claude** — Opus 4.8 with the web search tool, returning strict, schema-validated JSON.

**Core principle — the LLM curates, the code computes.** Claude picks/finds recipes and
names things; portion scaling, unit merges, shopping aggregation, same-product
consolidation, on-hand exclusion, and diet-conflict checks are all deterministic code, so
the arithmetic and the set logic are always trustworthy.

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

Open the client URL Vite prints. The dev server proxies `/api` to the backend, so there's
no CORS to configure. On first run you're taken through a one-time **setup screen** to
enter your preferences; the dashboard unlocks once you save.

## Test / build

```bash
npm test                         # server (vitest) + client (vitest + RTL)
npm run build                    # typecheck + build both packages
```

## Weekly flow

1. **New week** → pick the Monday-started week (defaults to the coming Monday), type the
   foods you already have to use up, add a free-text note, toggle which meals to plan, and
   flag any recent meals to avoid.
2. Claude generates the enabled meals in the background (progress is logged to the server
   console). You can leave and come back.
3. The dashboard shows the week board — each meal with its cuisine, protein/difficulty
   tags, times, per-serving calories, and a "Uses your …" badge when it uses something you
   had — plus the shopping list grouped by aisle.
4. **Copy** the shopping list or **Add to Apple Reminders** (see below). Rate meals and
   regenerate individual ones; history is kept for variety.

## Example week

A generated week (household: two active adults + a toddler; diets: Low-FODMAP; avoids:
spicy; lean-protein-forward) looks like this:

|       | Mon | Tue | Wed | Thu | Fri |
|-------|-----|-----|-----|-----|-----|
| **Breakfast** | Scrambled Eggs on Sourdough | Lactose-Free Greek Yogurt, Berries & Oats | Zucchini & Egg Fritters | Zucchini & Egg Fritters | Lactose-Free Greek Yogurt, Berries & Oats |
| **AM snack** | Banana | Orange & Grapes | Fresh Pineapple | Berries with Yogurt | Pear Slices |
| **Lunch** | Chicken & Rice Grain Bowl | Chicken Stir-Fry Rice Bowl *(leftovers)* | Tuna Fried Rice *(leftovers)* | Roasted Beet & Arugula Salad | Chicken & Fennel Tray Bake *(leftovers)* |
| **PM snack** | Boiled Eggs | Greek Yogurt with Berries | Rice Cakes with Cheddar | Boiled Eggs | Carrot Sticks with Cottage Cheese |
| **Dinner** | Chicken & Veg Stir-Fry with Rice | Tuna Fried Rice | One-Pot Chicken, Zucchini & Rice | Chicken, Fennel & Potato Bake | Salmon & Broccoli Tray Bake |

Each meal card carries its time and calories (e.g. *Chicken & Veg Stir-Fry — ⏱ 25 min ·
480 kcal*), and lunches are marked as leftovers of the prior dinner.

The shopping list is grouped by aisle, with foods you already have left off:

```
Meat            Bulk staples          Produce
- Chicken breast 810 g   - Canned tuna 300 g    - Broccoli 720 g
- Chicken thigh 1350 g   - Cooked rice 540 g    - Carrot 870 g
- Beef strips 450 g      - Rolled oats 180 g    - Zucchini 1020 g
Fish                     - Jasmine rice 900 g   - Green beans 180 g
- Salmon fillet 450 g    …                      …

Not listed — you said you already have: 1 Zucchini, 1 Fennel, 1 Broccoli, …
```

## Shopping list → Apple Reminders

The **Copy list** button copies a flat, one-item-per-line list of everything you haven't
checked off (checked = already have). The **Add to Apple Reminders** button copies the
list and launches an Apple **Shortcut** that turns each line into a reminder — Apple has no
web bulk-add API, so a one-time Shortcut is the supported bridge.

**One-time Shortcut setup** (iPhone/Mac). In the Shortcuts app, create a shortcut with
these actions, in order:

1. **Get Clipboard**
2. **Split** — set its input to the **Clipboard** variable, split by **New Lines**
3. **Repeat with each item** in *Split Text*
4. Inside the repeat: **Add New Reminder** — set the title to the **Repeat Item** variable,
   choose your grocery list, leave the alert as **No Alert**
5. **End Repeat**

> Insert the **Clipboard** and **Repeat Item** *variables* from the picker — don't type
> the words, or Shortcuts treats them as plain text.

Then in Weekly Simmer, open the shopping list's *"Set up Add to Apple Reminders"* section
and enter your shortcut's **exact name**. Tapping **Add to Apple Reminders** copies the
list and runs the shortcut, which reads the clipboard and adds one reminder per item.

## Your profile

Your preferences are saved in the `settings` table and edited any time from the **Settings**
tab. Until you've saved a profile, the app opens straight into the setup screen and
generation is blocked. To start over, delete the DB and restart:

```bash
rm server/mealplanner.db*        # then restart; you'll be taken through setup again
```

## Design docs

- [Design](docs/plans/2026-07-12-mealplanner-design.md)
- [Implementation plan](docs/plans/2026-07-12-mealplanner-implementation.md)
