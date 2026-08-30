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
or above their protein floor, with 30–68 g of fibre. Ruchi averages 1827 kcal with
112 g of protein; Dj averages 1898 kcal with 142 g.

The fortnight is searched, not chosen by eye — see `scripts/plan-week.mjs`. All 14
days are found in one pass, because the two weeks **share no meal**: a breakfast,
lunch or dinner served in week one never returns in week two, on either plate.
Snacks do recur. The protein-dense ones are what make 110 g and 140 g reachable
inside the calorie ceilings and they appear in almost every qualifying day, so
banning them across weeks leaves zero valid days — searching week one first and
then excluding its cast fails for the same reason, which is why both weeks are
planned together.

## What it does

**Today** — a calorie ring per person against their own goal, macro bars, and the
day's four meal slots. In *Both* mode each meal row has one tick per person, so
you can mark Dj's dinner eaten without touching Ruchi's.

**Two-week plan** — 14 days × 4 slots. On desktop it's a seven-column week grid:
drag a meal to move it, hold `Alt` while dragging to copy. On a phone it becomes
one readable card per day. **Repeat into week 2** clones a whole week; each day
has its own menu to copy it to tomorrow or next week. Bulk actions respect the
current profile scope. Per-day calories flag anything over 2000.

**Dish library** — 81 dishes across Indian, Asian, Middle Eastern, Italian,
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

**NOVA** — a nutrition assistant with its own instrument-panel surface, in two
panes: a **Console** you talk to and **Signals**, a live read of the week.

Signals plots each person's week as a stacked column of where the energy came
from — protein, carbs and fat, in kcal, because that is the only unit in which
they sum to the day's total — against their calorie goal as a reference line.
Both charts share one y-axis so the two people can actually be compared, hovering
or tab-focusing a day fills the readout above the chart, and every number is in a
table under *Show the numbers* so nothing is gated behind a hover.

The Console is given today's numbers, the fortnight's plan and every dish in the
library, and it **runs the app**: log a meal, plan or remove a dish, tick a meal
off, move a goal, copy or clear a day or a week, switch whose plan is showing,
open another screen, change the theme, add to the shopping list. Each change is
reported as a checked line under the reply. A diet clash is refused by the app
rather than trusted to the model, so nothing with meat, fish or egg reaches
Ruchi's plan. Without an API key it still answers from your own data: what's
planned, what's been eaten, what's left.

On OpenRouter, NOVA has its own model setting, separate from the photo one.
Photo analysis needs vision; NOVA needs tool calling and a long context but no
vision at all, and several of the best models for that are text-only. It defaults
to **GLM 5.2** (`z-ai/glm-5.2`) — tool calling over a 1M-token context at a
fraction of a frontier model's price; **Nemotron 3.5 Lightning** is the cheap
alternative. Pick anything else from either list, or type a slug.

Both pickers read from one catalogue in `lib/models.ts`, where each model carries
a `vision` flag. That flag decides which picker a model appears in, so a text-only
model can never be selected for photos; type one in by hand and Settings says so
rather than letting every capture fail with a misleading error.

The conversation persists — switching tabs or reloading no longer wipes it — and
NOVA learns two different ways. **Memories** are durable things it was told: a
dislike, an allergy, a routine. It stores them with a `remember` tool, and they
are listed as plain sentences in the Signals pane where you can add or delete
them, because memory you cannot inspect is memory you cannot correct. **Habits**
are read off the plan every turn — what gets planned most, and what gets planned
repeatedly but never ticked off — so they are never stored and never go stale.

Voice in uses the browser's speech recognition; voice out is off by default.

**Snap & track** — photograph a meal, say who ate it, and log its calories:

- **Anthropic** — the photo goes to `api.anthropic.com` and Claude identifies each
  component and estimates portions.
- **OpenRouter** — the photo goes to `openrouter.ai`, routed to whichever
  vision-capable model you pick (Claude Sonnet 5, Gemini 3.7 Flash, Nemotron 3
  Nano Omni, Inkling, MiMo-V2.5, GLM-4.6V…).
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
- **API keys** — a personal key is stored only in your browser and sent only to
  the provider you chose, for both photo analysis and NOVA. Choose *On-device*
  and the app never makes a network call.
- **A key for every session.** A deployment can carry its own OpenRouter key so
  the app works in any browser with nothing to paste. Set `OPENROUTER_API_KEY` in
  Vercel → Settings → Environment Variables; `api/openrouter.ts` reads it
  server-side and forwards the request, so the key never reaches the browser.
  It cannot be shipped any other way — this is a static client-side app, so a key
  in the source or in a `VITE_` variable ends up inside the JavaScript bundle
  every visitor downloads.

  The endpoint only accepts the models listed in `lib/models.ts`, caps
  `max_tokens`, and forwards nothing but the fields the app sends, since an open
  passthrough lets a caller bill the most expensive model on the platform to
  whoever owns the key. **Anyone who can reach the deployment can still spend its
  credits**, so either set `NOVA_ACCESS_CODE` — the app then asks for it once per
  browser — or put the deployment behind Vercel's Deployment Protection. A
  personal key entered in Settings always takes priority and bypasses the proxy
  entirely.
- **Nutrition numbers** come from `scripts/ingredient-nutrition.mjs`, a per-100 g
  table covering every ingredient in the library; `compute-nutrition.mjs` derives
  each dish's macros, fibre and portion weight from its actual quantities and
  rewrites `recipes.ts`. `audit-week.mjs` re-checks the seeded week against the
  profile goals. They are reference estimates for planning, not medical or dietetic
  advice. Photo estimates especially are a starting point — adjust them.
- **Voice** — speech recognition and synthesis are the browser's own. Chrome and
  Safari support both; Firefox has no recognition, and the microphone button is
  hidden where it is unavailable.
- **Videos** were researched per dish — a search per dish, then a specific video
  picked for a recognisable channel and a full recipe rather than a Short. They
  were found through search and not played end to end, so the odd one may have
  been taken down; every dish has an editable video URL and title for exactly
  that reason.
- **Saved state and library updates.** The whole library is persisted, so the
  merge on load keeps only dishes you have actually edited (`edited: true`) and
  takes everything else fresh. Before version 3 it kept whatever was in storage,
  which meant nobody who had opened the app before an update ever saw it.
- **Written recipe links** still point at a search on a reputable recipe site, so
  they don't rot. Paste your own URL on any dish to replace either link.
- **Drag-and-drop** on the planner is HTML5 drag, so it's desktop-only. On a phone
  you add and remove meals per day instead.

## Layout

```
src/
  data/recipes.ts       81-dish library, tagged by cuisine and contents
  data/foods.ts         per-100g reference table for offline photo estimates
  lib/profiles.ts       the two profiles and the diet rules
  lib/store.tsx         app state, persistence, scope-aware mutations, week seed
  lib/grocery.ts        ingredient roll-up, aisle grouping, purchase rounding
  lib/vision.ts         image compression, Anthropic + OpenRouter calls, offline estimator
  lib/assistant.ts      NOVA's context, tools, providers and on-device fallback
  lib/speech.ts         microphone dictation and spoken replies
  lib/serverKey.ts      one-shot probe for a deployment key, and the access code
  lib/nutrition.ts      per-profile macro maths and daily totals
  lib/theme.ts          theme + accent tokens, persistence, no-flash boot
  index.css             the design system: type, tokens, both themes, motion
  views/                Today · Planner · Recipes · Grocery · Snap · Assistant
  components/           UI primitives, rings, profile bits, recipe sheets, settings, HUD
api/
  openrouter.ts         server-side proxy holding the deployment's OpenRouter key
scripts/
  ingredient-nutrition.mjs  per-100 g values for every ingredient in the library
  compute-nutrition.mjs     derives each dish's macros and portion weight
  plan-week.mjs             searches for a week that meets both people's goals
  audit-week.mjs            re-checks the seeded week against the profile goals
```
