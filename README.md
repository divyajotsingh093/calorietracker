# 🥗 Nourish — meal & calorie tracker

A two-week meal planner, calorie tracker, recipe book and grocery list for a
household of two. Plan breakfast, lunch, dinner and snacks a fortnight ahead,
tick meals off as they're eaten, snap a photo of anything unplanned, and let the
shopping list build itself from whatever is on the plan.

Everything lives in the browser — no account, no server, no data leaving the device.

## Design

**Type.** Two self-hosted variable faces, no CDN and no FOUT. *Fraunces* — a serif
with optical-size, SOFT and WONK axes — carries the display sizes; its optical
axis keeps 40px headings tight and 18px ones readable without manual tracking.
*Inter* handles every piece of UI text and, with tabular figures switched on,
every number: an app this full of calories needs digits that line up in columns.

**Themes.** Light is the default — a warm paper ground rather than clinical white,
so the accent washes and food emoji sit comfortably on it. Dark, and follow-the-OS,
are one tap away and survive a reload; a tiny inline script applies the stored
choice before first paint so the page never flashes the wrong theme.

Five accent palettes — Matcha, Citrus, Berry, Ocean and Grape — repaint the primary
action, the calorie ring, the active nav state and the page's background wash.
Every colour is a semantic token (`--ink`, `--panel`, `--accent`, `--data-carbs`),
so a palette swap never touches a component.

**Contrast is measured, not asserted.** Thirteen foreground/background pairs are
checked across both themes and all five accents — 130 combinations, all clearing
WCAG AA. The light accents are set at the exact lightness where white text on the
primary button reaches 4.6:1.

**Motion** is used to show change, not to decorate: the calorie ring draws itself
in while its readout counts up, lists arrive with a 45ms stagger, the nav
indicator springs between tabs, and modals rise rather than appear. All of it
switches off under `prefers-reduced-motion`.

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

Both starter weeks land **under each person's calorie goal every single day**, at
or above their protein floor, with 32–58 g of fibre. Ruchi averages 1817 kcal with
110 g of protein; Dj averages 1893 kcal with 145 g. The week is found by search,
not chosen by eye — see `scripts/plan-week.mjs`.

## What it does

**Today** — a calorie ring per person against their own goal, macro bars, and the
day's four meal slots. In *Both* mode each meal row has one tick per person, so
you can mark Dj's dinner eaten without touching Ruchi's.

**Two-week plan** — 14 days × 4 slots. On desktop it's a seven-column week grid:
drag a meal to move it, hold `Alt` while dragging to copy. On a phone it becomes
one readable card per day. **Repeat into week 2** clones a whole week; each day
has its own menu to copy it to tomorrow or next week. Bulk actions respect the
current profile scope. Per-day calories flag anything over 2000.

**Dish library** — 69 dishes across Indian, Asian, Middle Eastern, Italian,
Continental, Mexican and salads, each tagged with what it contains (meat / fish /
egg / dairy) so diet filtering is exact. Every dish carries **per-serving nutrition
derived from its own ingredients**, the **weight of one portion in grams**, a full
ingredient list, a step-by-step method, a link to a written recipe **and a specific
cooking video**, searched out per dish and shown by title so you know what you're
opening. Both links are editable on any dish. Add your own with the
built-in editor; scale any recipe to the batch size you actually want to cook.

The starter fortnight is spread deliberately across cuisines — no single one is
more than a fifth of the week — so the plan doesn't drift into one kind of food.

**Grocery list** — everything planned for a week and for whoever is in scope,
rolled up per ingredient, de-duplicated and sorted by supermarket aisle.
Quantities round up to what a shop actually sells, so a plan needing a quarter of
a chicken still puts one chicken in the basket. Check items off, add extras, then
copy as text or print.

**NOVA** — a nutrition assistant with its own instrument-panel surface: a reactor
that changes colour and speed as it listens, thinks and speaks, live readouts of
what each person has left today, and a transcript. Talk to it or type. It is given
today's numbers, the fortnight's plan and every dish in the library, and it can act
on them — log a meal, plan or remove a dish, tick a meal off, add to the shopping
list — reporting each change as a checked line under its reply. A diet clash is
refused by the app rather than trusted to the model, so nothing with meat, fish or
egg reaches Ruchi's plan. Without an API key it still answers from your own data:
what's planned, what's been eaten, what's left.

On OpenRouter, NOVA has its own model setting, separate from the photo one.
Photo analysis needs vision; NOVA needs tool calling and a long context but no
vision at all, and the best models for that are text-only. It defaults to
**GLM 5.2** (`z-ai/glm-5.2`) — tool calling over a 1M-token context, at a
fraction of the price of a frontier model. Pick anything else from either list,
or type a slug.

Voice in uses the browser's speech recognition; voice out is off by default.

**Snap & track** — photograph a meal, say who ate it, and log its calories:

- **Anthropic** — the photo goes to `api.anthropic.com` and Claude identifies each
  component and estimates portions.
- **OpenRouter** — the photo goes to `openrouter.ai`, routed to whichever
  vision-capable model you pick (Claude, GPT-4o, Gemini, GLM-4.6V, Llama, Qwen…).
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
  chose, for both photo analysis and NOVA. Leave the provider on *On-device* and
  the app never makes a network call.
- **Nutrition numbers** come from `scripts/ingredient-nutrition.mjs`, a per-100 g
  table covering every ingredient in the library; `compute-nutrition.mjs` derives
  each dish's macros, fibre and portion weight from its actual quantities and
  rewrites `recipes.ts`. `audit-week.mjs` re-checks the seeded week against the
  profile goals. They are reference estimates for planning, not medical or dietetic
  advice. Photo estimates especially are a starting point — adjust them.
- **Voice** — speech recognition and synthesis are the browser's own. Chrome and
  Safari support both; Firefox has no recognition, and the microphone button is
  hidden where it is unavailable.
- **Videos** were researched per dish and point at specific videos, mostly from
  well-known cooking channels. They were found through search and were not
  fetch-verified one by one, so the odd one may have been taken down — every dish
  has an editable video URL and title for exactly that reason.
- **Written recipe links** still point at a search on a reputable recipe site, so
  they don't rot. Paste your own URL on any dish to replace either link.
- **Drag-and-drop** on the planner is HTML5 drag, so it's desktop-only. On a phone
  you add and remove meals per day instead.

## Layout

```
src/
  data/recipes.ts       69-dish library, tagged by cuisine and contents
  data/foods.ts         per-100g reference table for offline photo estimates
  lib/profiles.ts       the two profiles and the diet rules
  lib/store.tsx         app state, persistence, scope-aware mutations, week seed
  lib/grocery.ts        ingredient roll-up, aisle grouping, purchase rounding
  lib/vision.ts         image compression, Anthropic + OpenRouter calls, offline estimator
  lib/assistant.ts      NOVA's context, tools, providers and on-device fallback
  lib/speech.ts         microphone dictation and spoken replies
  lib/nutrition.ts      per-profile macro maths and daily totals
  lib/theme.ts          theme + accent tokens, persistence, no-flash boot
  index.css             the design system: type, tokens, both themes, motion
  views/                Today · Planner · Recipes · Grocery · Snap · Assistant
  components/           UI primitives, rings, profile bits, recipe sheets, settings, HUD
scripts/
  ingredient-nutrition.mjs  per-100 g values for every ingredient in the library
  compute-nutrition.mjs     derives each dish's macros and portion weight
  plan-week.mjs             searches for a week that meets both people's goals
  audit-week.mjs            re-checks the seeded week against the profile goals
```
