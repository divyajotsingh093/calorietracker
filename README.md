# 🥗 Nourish — meal & calorie tracker

A two-week meal planner, calorie tracker, recipe book and grocery list in one app.
Plan breakfast, lunch, dinner and snacks across a fortnight, tick meals off as you
eat them, snap a photo of anything unplanned, and let the shopping list build itself
from whatever is on the plan.

Everything lives in the browser — no account, no server, no data leaving the device.

## What it does

**Today** — a calorie ring against your goal, protein/carb/fat bars, and the day's four
meal slots. Tick a meal to count it towards the day, nudge servings up or down, or jump
straight to the recipe.

**Two-week plan** — 14 days × 4 slots on one grid. Drag a meal to move it, hold `Alt`
while dragging to copy it. **Repeat into week 2** clones a whole week in one click, and
each day has its own menu to copy it to tomorrow or to next week. Per-day calories and a
macro split bar sit at the top of every column.

**Dish library** — 24 dishes to start with, each with per-serving nutrition, a full
ingredient list, step-by-step method and a link out to a recipe site. Add your own dishes
with the built-in editor; scale any recipe's ingredients to the number of servings you
actually want to cook.

**Grocery list** — everything planned for a week, rolled up per ingredient, de-duplicated
and sorted by supermarket aisle. Quantities round up to what a shop actually sells, so a
plan needing a quarter of a chicken still puts one chicken in the basket. Check items off,
add your own extras, then copy the list as text or print it.

**Snap & track** — photograph a meal (camera or gallery) and log its calories:

- **With an Anthropic API key** (Settings → API key): the photo is sent to Claude, which
  identifies each component, estimates portions and returns calories and macros.
- **Without a key**: a built-in table of ~65 common foods estimates from a short
  description plus a portion size — type `200g grilled chicken, rice, salad` and it does
  the arithmetic.

Either way every number stays editable before you log it, and logged snaps count towards
the day's total alongside planned meals.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run lint
```

Requires Node 20+.

## Notes

- **Storage** — everything is kept in `localStorage` under `nourish.state.v1`.
  Settings has export/import for a JSON backup, plus a reset.
- **Camera** — `getUserMedia` needs a secure context, so use `localhost` or HTTPS.
  Uploading a photo works everywhere; on phones the file picker opens the camera directly.
- **API key** — stored only in your browser and sent only to `api.anthropic.com`. Leave it
  empty and the app never makes a network call.
- **Nutrition numbers** are reference estimates for planning, not medical or dietetic
  advice. Photo estimates in particular are a starting point — adjust them.
- **Recipe links** point at a search on a well-known recipe site rather than a deep link,
  so they don't rot; paste your own URL on any dish to replace it.

## Layout

```
src/
  data/recipes.ts       seed dish library
  data/foods.ts         per-100g reference table for offline photo estimates
  lib/store.tsx         app state, persistence, all mutations
  lib/grocery.ts        ingredient roll-up, aisle grouping, purchase rounding
  lib/vision.ts         image compression, Claude vision call, offline estimator
  lib/nutrition.ts      macro maths and daily totals
  views/                Today · Planner · Recipes · Grocery · Snap
  components/           UI primitives, rings, recipe sheets, settings
```
