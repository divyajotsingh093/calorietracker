import { AISLE_ORDER } from '@/lib/grocery'
import { dayTotals, macroSplit } from '@/lib/nutrition'
import { longDate, todayISO } from '@/lib/date'
import { suitsDiet } from '@/lib/profiles'
import { OpenRouterError, callOpenRouter } from '@/lib/openrouter'
import type { AppState, MealSlot, Memory, Profile, Recipe, Settings } from '@/types'

export type Role = 'user' | 'assistant'

export interface ActionRecord {
  /** the tool the model asked for, e.g. `log_meal` */
  name: string
  /** one line the reader can check, e.g. "Logged Dal Tadka for Dj — 446 kcal" */
  detail: string
  ok: boolean
}

export interface Turn {
  id: string
  role: Role
  text: string
  /** what the model actually did to the plan on this turn */
  actions?: ActionRecord[]
  /** set when the reply came from the on-device fallback rather than a model */
  local?: boolean
  error?: boolean
}

/* ─────────────────────────── context ─────────────────────────── */

const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

/**
 * A compact briefing on the household, today and the days either side of it.
 *
 * The assistant is only as good as what it knows, and it cannot query the
 * store, so everything it might reasonably be asked about is stated up front:
 * goals, what is planned, what has actually been eaten, and what remains.
 */
export function buildContext(
  state: AppState,
  recipes: Map<string, Recipe>,
  dates: string[],
): string {
  const today = todayISO()
  const lines: string[] = [`Today is ${longDate(today)} (${today}).`, '']

  for (const p of state.profiles) {
    const eaten = dayTotals(today, p.id, state.plan, state.photos, recipes, 'eaten')
    const planned = dayTotals(today, p.id, state.plan, state.photos, recipes, 'planned')
    const split = macroSplit(planned)
    lines.push(
      `${p.name} — ${p.diet === 'vegetarian' ? 'vegetarian, no egg' : 'eats everything'}. ` +
        `Goals ${p.calorieGoal} kcal, ${p.proteinGoal} g protein, ${p.fibreGoal} g fibre.`,
      `  eaten so far today: ${Math.round(eaten.calories)} kcal, ${Math.round(eaten.protein)} g protein, ${Math.round(eaten.fibre)} g fibre`,
      `  whole day as planned: ${Math.round(planned.calories)} kcal, ${Math.round(planned.protein)} g protein, ${Math.round(planned.fibre)} g fibre` +
        ` (${Math.round(split.protein)}% P / ${Math.round(split.carbs)}% C / ${Math.round(split.fat)}% F)`,
      `  remaining against goal: ${Math.round(p.calorieGoal - eaten.calories)} kcal, ${Math.round(p.proteinGoal - eaten.protein)} g protein`,
      `  diet: ${p.diet === 'vegetarian' ? 'vegetarian' : 'eats everything'}${p.eggInBatter ? ', egg only when baked into a batter' : ''}${p.staples?.length ? `; every day: ${p.staples.map((id) => recipes.get(id)?.name ?? id).join(', ')}` : ''}`,
    )
  }

  lines.push('', 'PLAN')
  for (const date of dates.slice(0, 8)) {
    const label = date === today ? `${longDate(date)} (today)` : longDate(date)
    const parts: string[] = []
    for (const slot of SLOT_ORDER) {
      const here = state.plan.filter((e) => e.date === date && e.slot === slot)
      if (!here.length) continue
      const byRecipe = new Map<string, string[]>()
      for (const e of here) {
        const who = state.profiles.find((p) => p.id === e.profileId)?.name ?? '?'
        byRecipe.set(e.recipeId, [...(byRecipe.get(e.recipeId) ?? []), who])
      }
      const text = [...byRecipe.entries()]
        .map(([id, who]) => {
          const r = recipes.get(id)
          if (!r) return null
          const eaten = here.some((e) => e.recipeId === id && e.eaten) ? ' ✓eaten' : ''
          return `${r.name} [${r.calories} kcal, ${r.protein} g P, ${r.servingGrams} g] for ${who.join(' & ')}${eaten}`
        })
        .filter(Boolean)
        .join('; ')
      if (text) parts.push(`${slot}: ${text}`)
    }
    const logged = state.photos.filter((p) => p.date === date)
    for (const l of logged) {
      const who = state.profiles.find((p) => p.id === l.profileId)?.name ?? '?'
      parts.push(`logged (${l.slot}): ${l.label} [${l.calories} kcal] for ${who}`)
    }
    lines.push(`${label}: ${parts.length ? parts.join(' | ') : 'nothing planned'}`)
  }

  return lines.join('\n')
}

/**
 * What NOVA has been told to remember, and what it can work out for itself.
 *
 * Two different kinds of learning, kept separate on purpose. Memories are
 * things somebody said — a dislike, an allergy, a habit — and they only exist
 * because a person or the assistant wrote them down, so they are listed as
 * plain sentences the user can read and delete. Habits are read off the plan
 * every turn: no storage, no drift, and no chance of the assistant believing
 * something the data stopped supporting weeks ago.
 */
export function buildMemory(memories: Memory[]): string {
  if (!memories.length) return ''
  return [
    '',
    '# What you have been told to remember',
    ...memories.map((m) => `- ${m.text}`),
    'Use these. If one turns out to be wrong, call forget and say so.',
  ].join('\n')
}

/** Habits read straight off the plan — never stored, so they cannot go stale. */
export function buildHabits(
  state: AppState,
  recipes: Map<string, Recipe>,
  profiles: Profile[],
): string {
  const lines: string[] = []

  for (const p of profiles) {
    const mine = state.plan.filter((e) => e.profileId === p.id)
    if (mine.length < 4) continue

    const count = new Map<string, number>()
    for (const e of mine) count.set(e.recipeId, (count.get(e.recipeId) ?? 0) + 1)
    const top = [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([id, n]) => `${recipes.get(id)?.name ?? id} (${n}x)`)

    // planned but never ticked off is the useful signal — it is the difference
    // between what they meant to eat and what they actually did
    const skipped = [...count.keys()].filter((id) => {
      const all = mine.filter((e) => e.recipeId === id)
      return all.length >= 2 && all.every((e) => !e.eaten)
    })
    const ticked = mine.filter((e) => e.eaten).length

    lines.push(`${p.name}: most planned — ${top.join(', ')}.`)
    if (ticked)
      lines.push(`  ${ticked} of ${mine.length} planned meals ticked off so far.`)
    if (skipped.length)
      lines.push(
        `  planned repeatedly but never ticked: ${skipped
          .map((id) => recipes.get(id)?.name ?? id)
          .slice(0, 4)
          .join(', ')} — worth asking whether they actually like it.`,
      )
  }

  const logged = state.photos.length
  if (logged) lines.push(`${logged} meals logged outside the plan.`)

  return lines.length ? ['', '# What the plan shows about them', ...lines].join('\n') : ''
}

/**
 * A one-line-per-dish index, so the model recommends real dishes by real id.
 *
 * Grouped by meal rather than listed flat. Asked for "an Italian dinner" against
 * a flat list of 81, small models start reasoning aloud about which ids exist
 * and can talk themselves into a loop; under a `## dinner` heading the
 * candidates are simply there to be read.
 */
export function buildLibrary(recipes: Recipe[]): string {
  const line = (r: Recipe) =>
    `${r.id} | ${r.name} | ${r.cuisine} | ${r.calories} kcal ` +
    `${r.protein}P ${r.carbs}C ${r.fat}F ${r.fibre}fib | ${r.servingGrams} g | ` +
    (suitsDiet(r, 'vegetarian') ? 'veg' : r.contains.join('+'))

  return SLOT_ORDER.map((slot) => {
    const here = recipes.filter((r) => r.slots.includes(slot))
    return [`## ${slot}`, ...here.map(line)].join('\n')
  }).join('\n\n')
}

export const SYSTEM_PROMPT = `You are NOVA, the resident nutrition assistant inside Nourish, a meal and calorie tracker used by two people: Ruchi (vegetarian, no egg) and Dj (eats everything).

How to answer:
- Be brief and concrete. Two or three sentences is usually right. Lead with the number or the answer, then the reason.
- You are given today's numbers and the plan. Use them. Never invent a figure you were not given, and never guess a dish's calories — every dish in the library is listed with its real macros.
- Ruchi is strictly vegetarian and eats no eggs. Never suggest meat, fish or egg for her, and never plan one onto her day.
- You run this app. When the person asks for a change — log a meal, plan or drop a dish, tick something off, copy or clear a day or a week, move a goal, switch whose plan is showing, open another screen, change the theme, add to the shopping list — call the matching tool. Never answer with instructions for doing it by hand, and never claim to have done something you did not call a tool for.
- After the tools run you are shown what actually happened. Say it in one line. If something was refused, say why in plain words.
- Always write a reply. A turn that calls a tool and then says nothing is a failure.
- When they tell you something durable about how they eat — a dislike, an allergy, a routine, a standing preference — call remember with one short sentence. Do not remember what they ate today, and never remember something they did not say.
- If a request is ambiguous about who it is for, and only one person is in view, assume that person. Otherwise ask.
- Portions matter: quote the serving weight when you recommend a dish.
- No preamble, no "certainly", no restating the question.

Suggest first, confirm after — do not make them do data entry:
- The plan already says what they are eating and every dish already carries its ingredients and macros. So when someone asks what to eat, propose actual dishes by name with their kcal and protein, and offer to put them on the plan. Do not ask them to tell you the calories of something in the library.
- Ruchi and Dj eat the same meals unless a swap is called for. Propose Ruchi's day first — she is the constraint, being vegetarian — and then say what Dj adds or swaps in to reach his higher protein target. He eats meat and fish; a lean non-vegetarian add-on for him is usually the right answer rather than a whole separate menu.
- Logging is for what went off-plan. When a planned meal was eaten, tick it off with mark_eaten instead of logging it again. Reach for log_meal only for something that was not on the plan.
- When a logged meal was wrong, correct it with edit_log. Never log a second copy of the same meal and ask them to delete the first.
- Dj has five boiled eggs every day; they are already on his plan as a staple, so never suggest them again and never log them.
- Ruchi eats egg beaten into a batter — pancakes — but not egg as egg. Suggest a pancake to her freely; never suggest an omelette, a boiled egg or a shakshuka.`

/* ─────────────────────────── tools ─────────────────────────── */

export interface ToolSpec {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export const TOOLS: ToolSpec[] = [
  {
    name: 'log_meal',
    description:
      'Record something eaten that was not on the plan. Use the real macros for the food; if unsure, estimate and say so in your reply.',
    input_schema: {
      type: 'object',
      properties: {
        person: { type: 'string', description: 'Ruchi or Dj' },
        label: { type: 'string', description: 'what was eaten' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        calories: { type: 'number' },
        protein: { type: 'number' },
        carbs: { type: 'number' },
        fat: { type: 'number' },
        fibre: { type: 'number' },
        date: { type: 'string', description: 'yyyy-mm-dd, defaults to today' },
      },
      required: ['person', 'label', 'slot', 'calories'],
    },
  },
  {
    name: 'plan_meal',
    description: 'Put a dish from the library on someone’s plan for a date and slot.',
    input_schema: {
      type: 'object',
      properties: {
        person: { type: 'string', description: 'Ruchi, Dj, or both' },
        recipe_id: { type: 'string', description: 'the r-... id from the dish library' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        date: { type: 'string', description: 'yyyy-mm-dd, defaults to today' },
        servings: { type: 'number' },
      },
      required: ['person', 'recipe_id', 'slot'],
    },
  },
  {
    name: 'remove_meal',
    description: 'Take a dish off someone’s plan for a date and slot.',
    input_schema: {
      type: 'object',
      properties: {
        person: { type: 'string', description: 'Ruchi, Dj, or both' },
        recipe_id: { type: 'string' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        date: { type: 'string', description: 'yyyy-mm-dd, defaults to today' },
      },
      required: ['person', 'recipe_id', 'slot'],
    },
  },
  {
    name: 'mark_eaten',
    description: 'Tick a planned meal off as eaten, or untick it.',
    input_schema: {
      type: 'object',
      properties: {
        person: { type: 'string', description: 'Ruchi, Dj, or both' },
        slot: { type: 'string', enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
        date: { type: 'string', description: 'yyyy-mm-dd, defaults to today' },
        eaten: { type: 'boolean', description: 'true to tick, false to untick' },
      },
      required: ['person', 'slot'],
    },
  },
  {
    name: 'edit_log',
    description:
      'Correct a meal already logged — the portion was wrong, or the estimate was off. Match it by what it was called. Use this rather than logging a second copy.',
    input_schema: {
      type: 'object',
      properties: {
        person: { type: 'string', description: 'Ruchi or Dj' },
        label: { type: 'string', description: 'the logged meal to correct, by name' },
        calories: { type: 'number' },
        protein: { type: 'number' },
        carbs: { type: 'number' },
        fat: { type: 'number' },
        fibre: { type: 'number' },
        new_label: { type: 'string', description: 'rename it, if the dish itself was wrong' },
        date: { type: 'string', description: 'yyyy-mm-dd, defaults to today' },
      },
      required: ['person', 'label'],
    },
  },
  {
    name: 'remove_log',
    description: 'Delete a logged meal that should not be there at all.',
    input_schema: {
      type: 'object',
      properties: {
        person: { type: 'string', description: 'Ruchi or Dj' },
        label: { type: 'string', description: 'the logged meal, by name' },
        date: { type: 'string', description: 'yyyy-mm-dd, defaults to today' },
      },
      required: ['person', 'label'],
    },
  },
  {
    name: 'set_goals',
    description:
      'Change someone’s daily targets. Only pass the ones being changed.',
    input_schema: {
      type: 'object',
      properties: {
        person: { type: 'string', description: 'Ruchi or Dj' },
        calories: { type: 'number' },
        protein: { type: 'number' },
        carbs: { type: 'number' },
        fat: { type: 'number' },
        fibre: { type: 'number' },
      },
      required: ['person'],
    },
  },
  {
    name: 'set_view',
    description:
      'Change whose plan the app is showing. Use when asked to “switch to Ruchi” or “show both”.',
    input_schema: {
      type: 'object',
      properties: { person: { type: 'string', description: 'Ruchi, Dj, or both' } },
      required: ['person'],
    },
  },
  {
    name: 'open_tab',
    description: 'Move the app to another screen.',
    input_schema: {
      type: 'object',
      properties: {
        tab: {
          type: 'string',
          enum: ['today', 'plan', 'recipes', 'grocery', 'snap'],
        },
      },
      required: ['tab'],
    },
  },
  {
    name: 'copy_day',
    description: 'Copy every meal from one date onto another, for whoever is in view.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'yyyy-mm-dd' },
        to: { type: 'string', description: 'yyyy-mm-dd' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'clear_day',
    description: 'Remove every planned meal from a date, for whoever is in view.',
    input_schema: {
      type: 'object',
      properties: { date: { type: 'string', description: 'yyyy-mm-dd' } },
      required: ['date'],
    },
  },
  {
    name: 'copy_week',
    description:
      'Copy a whole week of the visible fortnight onto the other one. 0 is this week, 1 is next.',
    input_schema: {
      type: 'object',
      properties: { from: { type: 'number' }, to: { type: 'number' } },
      required: ['from', 'to'],
    },
  },
  {
    name: 'set_appearance',
    description: 'Change the app’s light/dark mode or its accent colour.',
    input_schema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['light', 'dark', 'system'] },
        accent: { type: 'string', enum: ['matcha', 'citrus', 'berry', 'ocean', 'grape'] },
      },
    },
  },
  {
    name: 'remember',
    description:
      'Store something durable about the household so later conversations know it — a dislike, an allergy, a routine, a standing preference. One short sentence. Do not store one-off facts like what they ate today, and do not store anything they did not actually tell you.',
    input_schema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'one sentence, e.g. "Ruchi does not eat mushrooms"' },
      },
      required: ['fact'],
    },
  },
  {
    name: 'forget',
    description: 'Drop something you were remembering, when it turns out to be wrong or out of date.',
    input_schema: {
      type: 'object',
      properties: { fact: { type: 'string', description: 'the remembered line, or enough of it to match' } },
      required: ['fact'],
    },
  },
  {
    name: 'add_to_shopping_list',
    description: 'Add a one-off item to this week’s shopping list.',
    input_schema: {
      type: 'object',
      properties: {
        item: { type: 'string' },
        week: { type: 'number', description: '0 for this week, 1 for next' },
      },
      required: ['item'],
    },
  },
]

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

/** What the view hands back to the model after running a tool. */
export interface ToolResult {
  id: string
  content: string
  record: ActionRecord
}

/* ─────────────────────────── providers ─────────────────────────── */

/**
 * NOVA only ever sends text, so any model in the catalogue works. It does need
 * tool calling and room for the whole dish library plus the fortnight's plan.
 *
 * GLM 5.2's free tier is the default: tool calling over a 1M-token context, and
 * on the deployment key's allowed list.
 */
export const DEFAULT_CHAT_MODEL = 'z-ai/glm-5.2:free'


export interface Reply {
  text: string
  calls: ToolCall[]
  /** why the model stopped — 'length' means it ran out of budget mid-answer */
  finish: string
  /** the model produced only a scratchpad, or text that had come apart */
  noAnswer?: 'reasoning-only' | 'degenerate'
  /**
   * The assistant message exactly as the provider returned it. Tool protocols
   * require echoing it back verbatim on the next turn; rebuilding it by hand is
   * how a model ends up seeing a call it never made.
   */
  echo: unknown
}

interface AnthropicBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export type WireMessage = { role: 'user' | 'assistant' | 'tool'; [k: string]: unknown }

/**
 * True when a model is reachable; without one the local engine answers.
 *
 * `serverKeyReady` comes from the one-shot probe of this deployment's proxy, so
 * a browser with no personal key still gets a real model when the deployment
 * carries one.
 */
export function assistantProvider(
  settings: Settings,
  serverKeyReady = false,
): 'anthropic' | 'openrouter' | null {
  if (settings.visionProvider === 'anthropic' && settings.apiKey.trim()) return 'anthropic'
  if (settings.visionProvider === 'openrouter' && (settings.openrouterKey.trim() || serverKeyReady))
    return 'openrouter'
  // nobody has picked yet and this deployment has a key — use it
  if (!settings.providerChosen && serverKeyReady) return 'openrouter'
  return null
}

/**
 * Reply budget. This has to clear the model's own thinking as well as the
 * answer: a reasoning model given 900 tokens can spend all of them before it
 * writes a word, and returns empty content with finish_reason "length".
 */
const MAX_TOKENS = 3000

export async function askAnthropic(
  messages: WireMessage[],
  system: string,
  apiKey: string,
): Promise<Reply> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: MAX_TOKENS,
      system,
      tools: TOOLS,
      messages,
    }),
  })
  const json = (await res.json()) as {
    content?: AnthropicBlock[]
    stop_reason?: string
    error?: { message?: string }
  }
  if (!res.ok) throw new Error(json.error?.message ?? `Request failed (${res.status})`)

  const blocks = json.content ?? []
  return {
    text: blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('\n')
      .trim(),
    calls: blocks
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ id: b.id ?? '', name: b.name ?? '', input: b.input ?? {} })),
    finish: json.stop_reason === 'max_tokens' ? 'length' : (json.stop_reason ?? 'stop'),
    echo: { role: 'assistant', content: blocks },
  }
}

interface OpenAIToolCall {
  id: string
  type?: string
  function?: { name?: string; arguments?: string }
}

interface OpenAIMessage {
  role?: string
  content?: string | null
  /** OpenRouter surfaces a reasoning model's scratchpad separately from content */
  reasoning?: string | null
  tool_calls?: OpenAIToolCall[]
}

/**
 * With a personal key, the browser talks to OpenRouter directly. Without one it
 * posts to this deployment's own proxy, which holds the key server-side — that
 * is what lets the app work in a fresh browser with nothing pasted in.
 */
export async function askOpenRouter(
  messages: WireMessage[],
  system: string,
  apiKey: string,
  model: string,
): Promise<Reply> {
  const send = (withTools: boolean) =>
    callOpenRouter({
      apiKey,
      body: {
        model: model || DEFAULT_CHAT_MODEL,
        max_tokens: MAX_TOKENS,
        // Keep the thinking short so the budget goes on the answer. Every model
        // here can reason; none of them needs to for "what is left today?".
        reasoning: { effort: 'low' },
        // Push back on the repetition loop rather than only catching it after.
        frequency_penalty: 0.4,
        messages: [{ role: 'system', content: system }, ...messages],
        ...(withTools
          ? {
              tools: TOOLS.map((t) => ({
                type: 'function',
                function: {
                  name: t.name,
                  description: t.description,
                  parameters: t.input_schema,
                },
              })),
            }
          : {}),
      },
    })

  let json: Awaited<ReturnType<typeof send>>
  try {
    json = await send(true)
  } catch (e) {
    // Some endpoints serve a model but not its tool calling. Answering without
    // actions is much better than not answering at all, so drop the tools and
    // ask again — NOVA can still read the plan, it just cannot change it.
    if (e instanceof OpenRouterError && e.unsupported && /tool/i.test(e.message)) {
      json = await send(false)
    } else {
      throw e
    }
  }

  const parsed = json as {
    choices?: { message?: OpenAIMessage; finish_reason?: string }[]
  }

  const choice = parsed.choices?.[0]
  const msg = choice?.message ?? {}
  const calls = (msg.tool_calls ?? []).map((c) => {
    let input: Record<string, unknown> = {}
    try {
      input = JSON.parse(c.function?.arguments ?? '{}')
    } catch {
      input = {}
    }
    return { id: c.id, name: c.function?.name ?? '', input }
  })

  const content = (msg.content ?? '').trim()

  // Never show the scratchpad. Falling back to `reasoning` when content was
  // empty looked like a way to salvage a turn, but a model that produced no
  // answer is usually mid-collapse, and what it prints is its own muttering —
  // "r-? r-? r-?" for pages. An honest "nothing came back" beats that.
  const noAnswer: Reply['noAnswer'] = content
    ? degenerate(content)
      ? 'degenerate'
      : undefined
    : (msg.reasoning ?? '').trim()
      ? 'reasoning-only'
      : undefined

  return {
    text: noAnswer ? '' : content,
    calls,
    finish: choice?.finish_reason ?? 'stop',
    noAnswer,
    echo: { role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls },
  }
}

/**
 * True when a reply has come apart into repetition.
 *
 * Small models given a list of 81 dish ids sometimes start enumerating them and
 * never stop — "r-? r-? r-?" for hundreds of tokens. It is unmistakable to a
 * reader and cheap to catch: real prose keeps introducing new words, and a
 * collapsed reply stops doing that.
 */
export function degenerate(text: string): boolean {
  const words = text.toLowerCase().match(/[\w-]+/g) ?? []
  if (words.length < 40) return false
  const unique = new Set(words).size
  if (unique / words.length < 0.15) return true
  // or one token taking over the whole reply
  const counts = new Map<string, number>()
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1)
  return Math.max(...counts.values()) / words.length > 0.25
}

/** The tool-result turn, in whichever shape the provider expects. */
export function resultMessages(
  provider: 'anthropic' | 'openrouter',
  results: { call: ToolCall; record: ActionRecord }[],
): WireMessage[] {
  if (provider === 'anthropic') {
    return [
      {
        role: 'user',
        content: results.map((r) => ({
          type: 'tool_result',
          tool_use_id: r.call.id,
          content: r.record.detail,
          is_error: !r.record.ok,
        })),
      },
    ]
  }
  // OpenAI-style wants one `tool` message per call, keyed by id. Describing the
  // results in a user message instead is what left models re-calling the tool
  // and answering with nothing.
  return results.map((r) => ({
    role: 'tool',
    tool_call_id: r.call.id,
    name: r.call.name,
    content: `${r.record.ok ? 'ok' : 'failed'}: ${r.record.detail}`,
  }))
}

/**
 * What to say when the model returns no text at all. Never "Done." — that hides
 * a truncated answer, a refused tool and a dead model behind the same word.
 */
export function emptyReplyNote(reply: Reply, actions: ActionRecord[]): string {
  if (reply.noAnswer === 'degenerate') {
    return 'That model’s reply came apart into repetition — a small model losing the thread rather than anything you did. Ask again, or switch model in Settings.'
  }
  if (reply.noAnswer === 'reasoning-only') {
    return 'The model thought but never wrote an answer. Ask again, or switch to a model with tool calling in Settings.'
  }
  if (reply.finish === 'length') {
    return actions.length
      ? 'I made the change below, but ran out of reply budget before writing it up.'
      : 'The reply hit its length limit before any text came back. Try a shorter question, or a model with more room.'
  }
  if (actions.length) {
    return actions.every((a) => a.ok)
      ? 'Done — the change is listed below.'
      : 'That did not go through; see below.'
  }
  return 'The model sent an empty reply. Try asking again, or switch model in Settings.'
}

/* ─────────────────────── on-device fallback ─────────────────────── */

const GREETINGS = /\b(hi|hey|hello|yo|good (morning|evening|afternoon))\b/i

/**
 * Answers the handful of questions the app can answer from its own state, so
 * the assistant is useful before anyone pastes an API key. It does not pretend
 * to be the model — replies are marked as coming from on-device data.
 */
export function answerLocally(
  question: string,
  state: AppState,
  recipes: Map<string, Recipe>,
  profiles: Profile[],
): string {
  const q = question.toLowerCase()
  const today = todayISO()
  const who =
    profiles.find((p) => q.includes(p.name.toLowerCase())) ??
    (profiles.length === 1 ? profiles[0] : null)
  const targets = who ? [who] : profiles

  const budget = (p: Profile) => {
    const eaten = dayTotals(today, p.id, state.plan, state.photos, recipes, 'eaten')
    return {
      p,
      eaten,
      left: Math.round(p.calorieGoal - eaten.calories),
      protLeft: Math.round(p.proteinGoal - eaten.protein),
    }
  }

  if (/\b(left|remaining|budget|how many calories|can i eat)\b/.test(q)) {
    return targets
      .map((p) => {
        const b = budget(p)
        return `${p.name}: ${b.left} kcal left of ${p.calorieGoal}, and ${b.protLeft} g of protein still to go.`
      })
      .join('\n')
  }

  if (/\b(protein|fibre|fiber|macro)\b/.test(q)) {
    return targets
      .map((p) => {
        const e = dayTotals(today, p.id, state.plan, state.photos, recipes, 'eaten')
        return `${p.name}: ${Math.round(e.protein)} g protein and ${Math.round(e.fibre)} g fibre so far, against ${p.proteinGoal} and ${p.fibreGoal}.`
      })
      .join('\n')
  }

  const slot: MealSlot | null = /breakfast/.test(q)
    ? 'breakfast'
    : /lunch/.test(q)
      ? 'lunch'
      : /dinner|tonight|supper/.test(q)
        ? 'dinner'
        : /snack/.test(q)
          ? 'snack'
          : null

  if (slot || /\bwhat('s| is)? (for|on|planned)\b|\btoday\b|\bplan\b/.test(q)) {
    const slots: MealSlot[] = slot ? [slot] : SLOT_ORDER
    const out: string[] = []
    for (const p of targets) {
      for (const s of slots) {
        const here = state.plan.filter(
          (e) => e.date === today && e.slot === s && e.profileId === p.id,
        )
        const names = here
          .map((e) => recipes.get(e.recipeId))
          .filter((r): r is Recipe => Boolean(r))
          .map((r) => `${r.name} (${r.calories} kcal, ${r.servingGrams} g)`)
        if (names.length) out.push(`${p.name} — ${s}: ${names.join(', ')}`)
      }
    }
    return out.length ? out.join('\n') : 'Nothing is on the plan for that yet.'
  }

  if (/\b(shop|shopping|grocer|buy|order)\b/.test(q)) {
    return `The Groceries tab rolls the week's dishes into a list by aisle — ${AISLE_ORDER.length} of them, with quantities rounded to what a shop actually sells.`
  }

  if (GREETINGS.test(q) && q.length < 40) {
    const b = budget(targets[0])
    return `Online and reading the plan. ${b.p.name} has ${b.left} kcal and ${b.protLeft} g of protein left today.`
  }

  return 'I can answer that once a model is connected — add an Anthropic or OpenRouter key in Settings. Meanwhile I can tell you what is planned, what has been eaten, and how much of each goal is left.'
}
