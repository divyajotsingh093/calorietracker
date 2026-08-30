# 🥗 Nourish — meal & calorie tracker

A two-week meal planner, calorie tracker, recipe book and grocery list for a
household of two. Plan breakfast, lunch, dinner and snacks a fortnight ahead,
tick meals off as they're eaten, snap a photo of anything unplanned, and let the
shopping list build itself from whatever is on the plan.

Everything lives in the browser — no account, no server, no data leaving the device.

## Two people, two plans

The app ships with two profiles:

| | Diet | Daily goal |
|---|---|---|
| 🌿 **Ruchi** | Vegetarian — no meat, no fish, **no egg** | 1850 kcal |
| 🔥 **Dj** | Eats everything | 1950 kcal |

Switch between **Ruchi**, **Dj** and **Both** anywhere in the app. In *Both* mode
a meal planned for the two of them shows once with both avatars; meals for one
person are labelled "Ruchi only" / "Dj only". Every planning action asks who it
is for, so a shared dinner takes one tap and a swap takes two.

The dish picker hides anything that breaks the diet of whoever you're planning
for — Ruchi never sees chicken — with a "show them anyway" escape hatch. If you
pick a non-veg dish while both are selected, it is added only for the person who
eats it.

Both starter weeks land **under 2000 kcal every single day** (1644–1922).

## What it does

**Today** — a calorie ring per person against their own goal, macro bars, and the
day's four meal slots. In *Both* mode each meal row has one tick per person, so
you can mark Dj's dinner eaten without touching Ruchi's.

**Two-week plan** — 14 days × 4 slots. On desktop it's a seven-column week grid:
drag a meal to move it, hold `Alt` while dragging to copy. On a phone it becomes
one readable card per day. **Repeat into week 2** clones a whole week; each day
has its own menu to copy it to tomorrow or next week. Bulk actions respect the
current profile scope. Per-day calories flag anything over 2000.

**Dish library** — 58 dishes across Indian, Asian, Middle Eastern, Italian,
Continental, Mexican and salads, each tagged with what it contains (meat / fish /
egg / dairy) so diet filtering is exact. Every dish has per-serving nutrition, a
full ingredient list, a step-by-step method and a link out. Add your own with the
built-in editor; scale any recipe to the batch size you actually want to cook.

**Grocery list** — everything planned for a week and for whoever is in scope,
rolled up per ingredient, de-duplicated and sorted by supermarket aisle.
Quantities round up to what a shop actually sells, so a plan needing a quarter of
a chicken still puts one chicken in the basket. Check items off, add extras, then
copy as text or print.

**Snap & track** — photograph a meal, say who ate it, and log its calories:

- **Anthropic** — the photo goes to `api.anthropic.com` and Claude identifies each
  component and estimates portions.
- **OpenRouter** — the photo goes to `openrouter.ai`, routed to whichever
  vision-capable model you pick (Claude, GPT-4o, Gemini, Llama, Qwen…).
- **On-device** — no key and no network call: describe the plate, pick a portion
  size, and a bundled table of ~65 common foods does the arithmetic.

Every number stays editable before you log it, and logged snaps count towards the
day's total alongside planned meals.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run lint
```

Requires Node 20+.

## Notes

- **Storage** — everything is kept in `localStorage` under `nourish.state.v2`.
  Settings has export/import for a JSON backup, plus a reset.
- **Camera** — `getUserMedia` needs a secure context, so use `localhost` or HTTPS.
  Uploading works everywhere; on phones the file picker opens the camera directly.
- **API keys** — stored only in your browser and sent only to the provider you
  chose. Leave the provider on *On-device* and the app never makes a network call.
- **Nutrition numbers** are reference estimates for planning, not medical or
  dietetic advice. Photo estimates especially are a starting point — adjust them.
- **Recipe links** point at a search on a well-known recipe site rather than a
  deep link, so they don't rot; paste your own URL on any dish to replace it.
- **Drag-and-drop** on the planner is HTML5 drag, so it's desktop-only. On a phone
  you add and remove meals per day instead.

## Layout

```
src/
  data/recipes.ts       58-dish library, tagged by cuisine and contents
  data/foods.ts         per-100g reference table for offline photo estimates
  lib/profiles.ts       the two profiles and the diet rules
  lib/store.tsx         app state, persistence, scope-aware mutations, week seed
  lib/grocery.ts        ingredient roll-up, aisle grouping, purchase rounding
  lib/vision.ts         image compression, Anthropic + OpenRouter calls, offline estimator
  lib/nutrition.ts      per-profile macro maths and daily totals
  views/                Today · Planner · Recipes · Grocery · Snap
  components/           UI primitives, rings, profile bits, recipe sheets, settings
```
