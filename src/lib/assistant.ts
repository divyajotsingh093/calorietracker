import { AISLE_ORDER } from '@/lib/grocery'
import { dayTotals, macroSplit } from '@/lib/nutrition'
import { longDate, todayISO } from '@/lib/date'
import { suitsDiet } from '@/lib/profiles'
import type { AppState, MealSlot, Profile, Recipe, Settings } from '@/types'

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

/** A one-line-per-dish index, so the model recommends real dishes by real id. */
export function buildLibrary(recipes: Recipe[]): string {
  return recipes
    .map(
      (r) =>
        `${r.id} | ${r.name} | ${r.cuisine} | ${r.slots.join('/')} | ${r.calories} kcal ` +
        `${r.protein}P ${r.carbs}C ${r.fat}F ${r.fibre}fib | ${r.servingGrams} g | ` +
        (suitsDiet(r, 'vegetarian') ? 'veg' : r.contains.join('+')),
    )
    .join('\n')
}

export const SYSTEM_PROMPT = `You are NOVA, the resident nutrition assistant inside Nourish, a meal and calorie tracker used by two people: Ruchi (vegetarian, no egg) and Dj (eats everything).

How to answer:
- Be brief and concrete. Two or three sentences is usually right. Lead with the number or the answer, then the reason.
- You are given today's numbers and the plan. Use them. Never invent a figure you were not given, and never guess a dish's calories — every dish in the library is listed with its real macros.
- Ruchi is strictly vegetarian and eats no eggs. Never suggest meat, fish or egg for her, and never plan one onto her day.
- When the person asks you to change something — log a meal, plan a dish, tick something off, add to the shopping list — call the matching tool rather than describing what they should do. Then say in one line what you did.
- If a request is ambiguous about who it is for, and only one person is in view, assume that person. Otherwise ask.
- Portions matter: quote the serving weight when you recommend a dish.
- No preamble, no "certainly", no restating the question.`

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

export interface Reply {
  text: string
  calls: ToolCall[]
}

interface AnthropicBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export type WireMessage =
  | { role: 'user' | 'assistant'; content: string }
  | { role: 'user' | 'assistant'; content: unknown[] }

/** True when a model is configured; without one the local engine answers. */
export function assistantProvider(settings: Settings): 'anthropic' | 'openrouter' | null {
  if (settings.visionProvider === 'anthropic' && settings.apiKey.trim()) return 'anthropic'
  if (settings.visionProvider === 'openrouter' && settings.openrouterKey.trim())
    return 'openrouter'
  return null
}

/**
 * NOVA only ever sends text, so any model in the catalogue works. It does need
 * tool calling and room for the whole dish library plus the fortnight's plan.
 *
 * GLM 5.2 is the default: tool calling over a 1M-token context, at a fraction
 * of a frontier model's price.
 */
export const DEFAULT_CHAT_MODEL = 'z-ai/glm-5.2'

const MAX_TOKENS = 900

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
  const json = (await res.json()) as { content?: AnthropicBlock[]; error?: { message?: string } }
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
  }
}

interface OpenAIToolCall {
  id: string
  function?: { name?: string; arguments?: string }
}

export async function askOpenRouter(
  messages: WireMessage[],
  system: string,
  apiKey: string,
  model: string,
): Promise<Reply> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Nourish meal tracker',
    },
    body: JSON.stringify({
      model: model || DEFAULT_CHAT_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'system', content: system }, ...messages],
      tools: TOOLS.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      })),
    }),
  })
  const json = (await res.json()) as {
    choices?: { message?: { content?: string; tool_calls?: OpenAIToolCall[] } }[]
    error?: { message?: string }
  }
  if (!res.ok) throw new Error(json.error?.message ?? `Request failed (${res.status})`)
  // OpenRouter can answer 200 with an error body when the upstream model fails.
  if (json.error?.message) throw new Error(json.error.message)

  const msg = json.choices?.[0]?.message
  return {
    text: (msg?.content ?? '').trim(),
    calls: (msg?.tool_calls ?? []).map((c) => {
      let input: Record<string, unknown> = {}
      try {
        input = JSON.parse(c.function?.arguments ?? '{}')
      } catch {
        input = {}
      }
      return { id: c.id, name: c.function?.name ?? '', input }
    }),
  }
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
