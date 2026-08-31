import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { SEED_RECIPES } from '@/data/recipes'
import { addDays, currentMondayISO } from '@/lib/date'
import { DEFAULT_PROFILES } from '@/lib/profiles'
import { DEFAULT_CHAT_MODEL } from '@/lib/assistant'
import { DEFAULT_OPENROUTER_MODEL } from '@/lib/vision'
import type {
  AppState,
  ChatTurn,
  MealSlot,
  Memory,
  PhotoLog,
  PlanEntry,
  Profile,
  Recipe,
  Scope,
  Settings,
} from '@/types'

const KEY = 'nourish.state.v2'
const VERSION = 3

/**
 * How much of the NOVA conversation is kept. Everything lives in one
 * localStorage entry alongside the plan and any photo logs, and photos are the
 * expensive part of that budget, so the transcript gets a hard ceiling rather
 * than growing until a save silently fails.
 */
const CHAT_CAP = 80

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const DEFAULT_SETTINGS: Settings = {
  visionProvider: 'offline',
  apiKey: '',
  openrouterKey: '',
  openrouterModel: DEFAULT_OPENROUTER_MODEL,
  openrouterChatModel: DEFAULT_CHAT_MODEL,
}

/** `[Ruchi, Dj]` when the two differ, one id when they eat the same thing. */
type Pick = string | [string, string]

interface DaySpec {
  breakfast: Pick
  lunch: Pick
  dinner: Pick
  snack: Pick[]
}

/**
 * The starter fortnight, Monday first, searched by `scripts/plan-week.mjs`
 * rather than chosen by eye. Every day clears its protein target inside its
 * calorie budget, carries at least 30 g of fibre, spans at least three cuisines,
 * repeats nothing from the day before, and keeps Ruchi's column strictly
 * vegetarian — egg only where it is beaten into a batter.
 *
 * The two weeks share no meal at all: a breakfast, lunch or dinner served in
 * week one never comes back in week two, on either plate. Snacks do recur —
 * the protein-dense ones are what make 110 g and 140 g reachable inside the
 * calorie ceilings, and banning them across weeks leaves no valid days at all.
 *
 * Dj's five boiled eggs are his breakfast, so nothing is planned into that slot
 * for him and his day is the eggs plus lunch, dinner and two snacks. The
 * breakfast each day names is Ruchi's alone.
 *
 * As seeded — week 1: Ruchi 1819 kcal / 112 g protein / 51 g fibre, Dj 1834 /
 * 149 / 36. Week 2: Ruchi 1819 / 112 / 51, Dj 1876 / 148 / 38.
 */
const WEEK1: DaySpec[] = [
  {
    // Mon — Indian / Asian / Mexican / Middle Eastern / Continental
    breakfast: 'r-besan-chilla',
    lunch: ['r-miso-ramen-veg', 'r-beef-stirfry'],
    dinner: ['r-black-bean-soup', 'r-chicken-burrito-bowl'],
    snack: ['r-labneh-zaatar', 'r-berry-protein-smoothie'],
  },
  {
    // Tue — Continental / Middle Eastern / Italian / Salads / Asian
    breakfast: 'r-pb-banana-toast',
    lunch: ['r-lentil-soup', 'r-chicken-shawarma'],
    dinner: ['r-minestrone', 'r-tuna-puttanesca'],
    snack: ['r-sesame-slaw', 'r-edamame'],
  },
  {
    // Wed — Indian / Asian / Middle Eastern / Continental / Italian
    breakfast: 'r-besan-chilla',
    lunch: ['r-miso-ramen-veg', 'r-beef-stirfry'],
    dinner: ['r-stuffed-peppers', 'r-chicken-shawarma'],
    snack: ['r-berry-protein-smoothie', 'r-white-bean-dip'],
  },
  {
    // Thu — Continental / Salads / Italian / Indian / Mexican
    breakfast: 'r-seed-yogurt-bowl',
    lunch: 'r-sesame-slaw',
    dinner: ['r-mushroom-risotto', 'r-roast-chicken'],
    snack: ['r-dhokla', 'r-black-bean-dip'],
  },
  {
    // Fri — Indian / Asian / Mexican / Middle Eastern
    breakfast: 'r-besan-chilla',
    lunch: ['r-miso-ramen-veg', 'r-beef-stirfry'],
    dinner: ['r-black-bean-soup', 'r-chicken-burrito-bowl'],
    snack: ['r-hummus-plate', 'r-tzatziki'],
  },
  {
    // Sat — Continental / Salads / Middle Eastern / Indian
    breakfast: 'r-seed-yogurt-bowl',
    lunch: 'r-sesame-slaw',
    dinner: ['r-mujadara', 'r-chicken-shawarma'],
    snack: ['r-dhokla', 'r-berry-protein-smoothie'],
  },
  {
    // Sun — Indian / Middle Eastern / Asian
    breakfast: 'r-poha',
    lunch: ['r-lentil-soup', 'r-chicken-shawarma'],
    dinner: ['r-mapo-tofu-veg', 'r-beef-stirfry'],
    snack: ['r-edamame', 'r-tzatziki'],
  },
]

const WEEK2: DaySpec[] = [
  {
    // Mon — Asian / Middle Eastern / Indian / Salads / Continental
    breakfast: 'r-congee',
    lunch: ['r-fattoush-halloumi', 'r-harissa-prawns'],
    dinner: ['r-dal-tadka', 'r-chicken-tikka-masala'],
    snack: ['r-sesame-slaw', 'r-berry-protein-smoothie'],
  },
  {
    // Tue — Continental / Indian / Salads / Asian / Mexican
    breakfast: 'r-overnight-oats',
    lunch: 'r-soya-keema',
    dinner: ['r-chickpea-halloumi-salad', 'r-souvlaki-bowl'],
    snack: ['r-edamame', 'r-black-bean-dip'],
  },
  {
    // Wed — Indian / Middle Eastern / Asian / Salads
    breakfast: 'r-dhokla',
    lunch: ['r-fattoush-halloumi', 'r-harissa-prawns'],
    dinner: ['r-tempeh-stirfry', 'r-teriyaki-salmon-donburi'],
    snack: ['r-sesame-slaw', 'r-moong-chaat'],
  },
  {
    // Thu — Asian / Italian / Indian / Continental / Mexican
    breakfast: 'r-congee',
    lunch: ['r-lentil-ragu', 'r-turkey-meatballs'],
    dinner: 'r-soya-keema',
    snack: ['r-berry-protein-smoothie', 'r-black-bean-dip'],
  },
  {
    // Fri — Continental / Middle Eastern / Asian / Salads
    breakfast: 'r-yoghurt-parfait',
    lunch: ['r-fattoush-halloumi', 'r-harissa-prawns'],
    dinner: ['r-veg-fried-rice', 'r-teriyaki-salmon-donburi'],
    snack: ['r-sesame-slaw', 'r-tzatziki'],
  },
  {
    // Sat — Indian / Asian / Mexican
    breakfast: 'r-dhokla',
    lunch: ['r-tempeh-stirfry', 'r-teriyaki-salmon-donburi'],
    dinner: ['r-palak-paneer', 'r-chicken-tikka-masala'],
    snack: ['r-edamame', 'r-black-bean-dip'],
  },
  {
    // Sun — Asian / Italian / Indian / Continental
    breakfast: 'r-congee',
    lunch: ['r-lentil-ragu', 'r-turkey-meatballs'],
    dinner: 'r-soya-keema',
    snack: ['r-berry-protein-smoothie', 'r-white-bean-dip'],
  },
]

function seedPlan(anchor: string, profiles: Profile[]): PlanEntry[] {
  const entries: PlanEntry[] = []
  const push = (date: string, slot: MealSlot, pick: Pick) => {
    profiles.forEach((profile, i) => {
      // a slot a staple stands in for is not planned into at all
      if (profile.staplesReplace?.includes(slot)) return
      const recipeId = Array.isArray(pick) ? pick[Math.min(i, pick.length - 1)] : pick
      entries.push({ id: uid(), profileId: profile.id, date, slot, recipeId, servings: 1, eaten: false })
    })
  }
  // staples first, so day one already has them
  for (let i = 0; i < 14; i++) {
    const date = addDays(anchor, i)
    for (const profile of profiles) {
      for (const recipeId of profile.staples ?? []) {
        entries.push({
          id: uid(),
          profileId: profile.id,
          date,
          slot: 'breakfast',
          recipeId,
          servings: 1,
          eaten: false,
        })
      }
    }
  }

  ;[...WEEK1, ...WEEK2].forEach((day, i) => {
    const date = addDays(anchor, i)
    push(date, 'breakfast', day.breakfast)
    push(date, 'lunch', day.lunch)
    push(date, 'dinner', day.dinner)
    day.snack.forEach((s) => push(date, 'snack', s))
  })
  return entries
}

function freshState(): AppState {
  const anchor = currentMondayISO()
  return {
    version: VERSION,
    settings: DEFAULT_SETTINGS,
    profiles: DEFAULT_PROFILES,
    scope: 'both',
    recipes: SEED_RECIPES,
    plan: seedPlan(anchor, DEFAULT_PROFILES),
    photos: [],
    anchor,
    checked: [],
    extras: [],
    chat: [],
    memories: [],
    stapled: [],
  }
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    const base = freshState()

    // Merge so new seed dishes, and updates to existing ones, survive a reload.
    //
    // The whole library is persisted, so "keep whatever is in storage" meant the
    // seed copy never won and nobody who had opened the app before an update
    // ever saw it -- videos, portion weights and recomputed macros all stopped
    // at whatever was saved first. Only a dish the user actually edited is kept,
    // and `edited` did not exist before version 3, so older saves take the fresh
    // library wholesale rather than staying frozen for good.
    const custom = (parsed.recipes ?? []).filter((r) => r.custom)
    const keepEdits = (parsed.version ?? 0) >= 3
    const edited = new Map(
      (parsed.recipes ?? [])
        .filter((r) => !r.custom && r.edited && keepEdits)
        .map((r) => [r.id, r]),
    )
    return {
      ...base,
      ...parsed,
      version: VERSION,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
      profiles: parsed.profiles?.length ? parsed.profiles : base.profiles,
      scope: parsed.scope ?? base.scope,
      recipes: [...SEED_RECIPES.map((r) => edited.get(r.id) ?? r), ...custom],
      plan: parsed.plan ?? base.plan,
      photos: parsed.photos ?? [],
      anchor: parsed.anchor ?? base.anchor,
      checked: parsed.checked ?? [],
      extras: parsed.extras ?? [],
      // the conversation is capped on write; trim again on read in case an
      // older save carries more than the cap
      chat: (parsed.chat ?? []).slice(-CHAT_CAP),
      memories: parsed.memories ?? [],
      stapled: parsed.stapled ?? [],
    }
  } catch {
    return freshState()
  }
}

interface Store {
  state: AppState
  recipeMap: Map<string, Recipe>
  /** dates of the visible fortnight */
  days: string[]
  /** the profiles the current scope covers */
  scoped: Profile[]
  /** the single profile in view, or null in "both" mode */
  activeProfile: Profile | null
  setScope: (scope: Scope) => void
  setSettings: (patch: Partial<Settings>) => void
  updateProfile: (id: string, patch: Partial<Profile>) => void
  setAnchor: (iso: string) => void
  addPlanEntry: (
    date: string,
    slot: MealSlot,
    recipeId: string,
    profileIds: string[],
    servings?: number,
  ) => void
  removePlanEntry: (id: string) => void
  removeMeal: (date: string, slot: MealSlot, recipeId: string, profileIds: string[]) => void
  updatePlanEntry: (id: string, patch: Partial<PlanEntry>) => void
  toggleEaten: (id: string) => void
  movePlanEntry: (ids: string[], date: string, slot: MealSlot) => void
  copyDay: (from: string, to: string) => void
  clearDay: (date: string) => void
  copyWeek: (fromWeek: 0 | 1, toWeek: 0 | 1) => void
  clearWeek: (week: 0 | 1) => void
  saveRecipe: (recipe: Recipe) => void
  deleteRecipe: (id: string) => void
  addPhoto: (log: Omit<PhotoLog, 'id' | 'createdAt'>) => void
  removePhoto: (id: string) => void
  /** correct a logged meal in place, rather than logging a second copy */
  updatePhoto: (id: string, patch: Partial<PhotoLog>) => void
  toggleChecked: (key: string) => void
  clearChecked: (week: number) => void
  addExtra: (week: number, text: string) => void
  removeExtra: (id: string) => void
  /**
   * Put each profile's staples on any of `dates` that has not had them yet.
   * Idempotent, and a date is marked once, so deleting a staple sticks.
   */
  syncStaples: (dates: string[]) => void
  /** append one turn to the NOVA conversation */
  addTurn: (turn: Omit<ChatTurn, 'id' | 'at'>) => ChatTurn
  clearChat: () => void
  remember: (text: string, source?: Memory['source']) => Memory | null
  forget: (id: string) => void
  clearMemories: () => void
  resetAll: () => void
  importState: (raw: string) => boolean
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => load())
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* quota exceeded — photos are the usual culprit; keep running in memory */
    }
  }, [state])

  const patch = useCallback((fn: (s: AppState) => AppState) => setState(fn), [])

  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(state.anchor, i)),
    [state.anchor],
  )

  const recipeMap = useMemo(() => new Map(state.recipes.map((r) => [r.id, r])), [state.recipes])

  const scoped = useMemo(
    () =>
      state.scope === 'both'
        ? state.profiles
        : state.profiles.filter((p) => p.id === state.scope),
    [state.profiles, state.scope],
  )

  const activeProfile = scoped.length === 1 ? scoped[0] : null

  const api = useMemo<Store>(() => {
    const weekDates = (s: AppState, week: 0 | 1) =>
      Array.from({ length: 7 }, (_, i) => addDays(s.anchor, week * 7 + i))

    /** Scope-aware: bulk actions only touch the profiles currently in view. */
    const inScope = (s: AppState, e: PlanEntry) =>
      s.scope === 'both' || e.profileId === s.scope

    return {
      state,
      recipeMap,
      days,
      scoped,
      activeProfile,

      setScope: (scope) => patch((s) => ({ ...s, scope })),
      setSettings: (p) => patch((s) => ({ ...s, settings: { ...s.settings, ...p } })),
      updateProfile: (id, p) =>
        patch((s) => ({
          ...s,
          profiles: s.profiles.map((x) => (x.id === id ? { ...x, ...p } : x)),
        })),
      setAnchor: (iso) => patch((s) => ({ ...s, anchor: iso })),

      addPlanEntry: (date, slot, recipeId, profileIds, servings = 1) =>
        patch((s) => ({
          ...s,
          plan: [
            ...s.plan,
            ...profileIds.map((profileId) => ({
              id: uid(),
              profileId,
              date,
              slot,
              recipeId,
              servings,
              eaten: false,
            })),
          ],
        })),

      removePlanEntry: (id) => patch((s) => ({ ...s, plan: s.plan.filter((e) => e.id !== id) })),

      removeMeal: (date, slot, recipeId, profileIds) =>
        patch((s) => ({
          ...s,
          plan: s.plan.filter(
            (e) =>
              !(
                e.date === date &&
                e.slot === slot &&
                e.recipeId === recipeId &&
                profileIds.includes(e.profileId)
              ),
          ),
        })),

      updatePlanEntry: (id, p) =>
        patch((s) => ({ ...s, plan: s.plan.map((e) => (e.id === id ? { ...e, ...p } : e)) })),

      toggleEaten: (id) =>
        patch((s) => ({
          ...s,
          plan: s.plan.map((e) => (e.id === id ? { ...e, eaten: !e.eaten } : e)),
        })),

      movePlanEntry: (ids, date, slot) =>
        patch((s) => ({
          ...s,
          plan: s.plan.map((e) => (ids.includes(e.id) ? { ...e, date, slot } : e)),
        })),

      copyDay: (from, to) =>
        patch((s) => {
          const source = s.plan.filter((e) => e.date === from && inScope(s, e))
          const kept = s.plan.filter((e) => !(e.date === to && inScope(s, e)))
          return {
            ...s,
            plan: [...kept, ...source.map((e) => ({ ...e, id: uid(), date: to, eaten: false }))],
          }
        }),

      clearDay: (date) =>
        patch((s) => ({
          ...s,
          plan: s.plan.filter((e) => !(e.date === date && inScope(s, e))),
        })),

      copyWeek: (fromWeek, toWeek) =>
        patch((s) => {
          const from = weekDates(s, fromWeek)
          const to = weekDates(s, toWeek)
          const map = new Map(from.map((d, i) => [d, to[i]]))
          const source = s.plan.filter((e) => map.has(e.date) && inScope(s, e))
          const kept = s.plan.filter((e) => !(to.includes(e.date) && inScope(s, e)))
          return {
            ...s,
            plan: [
              ...kept,
              ...source.map((e) => ({ ...e, id: uid(), date: map.get(e.date)!, eaten: false })),
            ],
          }
        }),

      clearWeek: (week) =>
        patch((s) => {
          const dates = weekDates(s, week)
          return { ...s, plan: s.plan.filter((e) => !(dates.includes(e.date) && inScope(s, e))) }
        }),

      saveRecipe: (recipe) =>
        patch((s) => {
          // Mark an edit to a seed dish, so the merge on load knows to keep it.
          const saved = recipe.custom ? recipe : { ...recipe, edited: true }
          return {
            ...s,
            recipes: s.recipes.some((r) => r.id === saved.id)
              ? s.recipes.map((r) => (r.id === saved.id ? saved : r))
              : [...s.recipes, saved],
          }
        }),

      deleteRecipe: (id) =>
        patch((s) => ({
          ...s,
          recipes: s.recipes.filter((r) => r.id !== id),
          plan: s.plan.filter((e) => e.recipeId !== id),
        })),

      addPhoto: (log) =>
        patch((s) => ({
          ...s,
          photos: [{ ...log, id: uid(), createdAt: Date.now() }, ...s.photos],
        })),

      removePhoto: (id) => patch((s) => ({ ...s, photos: s.photos.filter((p) => p.id !== id) })),

      updatePhoto: (id, p) =>
        patch((s) => ({
          ...s,
          photos: s.photos.map((x) => (x.id === id ? { ...x, ...p, id: x.id } : x)),
        })),

      toggleChecked: (key) =>
        patch((s) => ({
          ...s,
          checked: s.checked.includes(key)
            ? s.checked.filter((k) => k !== key)
            : [...s.checked, key],
        })),

      clearChecked: (week) =>
        patch((s) => ({ ...s, checked: s.checked.filter((k) => !k.startsWith(`${week}|`)) })),

      addExtra: (week, text) =>
        patch((s) => ({ ...s, extras: [...s.extras, { id: uid(), week, text }] })),

      removeExtra: (id) => patch((s) => ({ ...s, extras: s.extras.filter((e) => e.id !== id) })),

      syncStaples: (dates) =>
        patch((s) => {
          const todo = dates.filter((d) => !s.stapled.includes(d))
          if (!todo.length) return s
          const added: PlanEntry[] = []
          for (const date of todo) {
            for (const profile of s.profiles) {
              for (const recipeId of profile.staples ?? []) {
                const already = s.plan.some(
                  (e) => e.date === date && e.profileId === profile.id && e.recipeId === recipeId,
                )
                if (already) continue
                added.push({
                  id: uid(),
                  profileId: profile.id,
                  date,
                  slot: 'breakfast',
                  recipeId,
                  servings: 1,
                  eaten: false,
                })
              }
            }
          }
          return { ...s, plan: [...s.plan, ...added], stapled: [...s.stapled, ...todo] }
        }),

      addTurn: (turn) => {
        const full: ChatTurn = { ...turn, id: uid(), at: Date.now() }
        patch((s) => ({ ...s, chat: [...s.chat, full].slice(-CHAT_CAP) }))
        return full
      },
      clearChat: () => patch((s) => ({ ...s, chat: [] })),

      remember: (text, source = 'nova') => {
        const clean = text.trim().slice(0, 240)
        if (!clean) return null
        // a memory NOVA keeps re-noticing should not pile up as duplicates
        const dupe = state.memories.find(
          (m) => m.text.toLowerCase() === clean.toLowerCase(),
        )
        if (dupe) return dupe
        const m: Memory = { id: uid(), text: clean, source, createdAt: Date.now() }
        patch((s) => ({ ...s, memories: [...s.memories, m].slice(-40) }))
        return m
      },
      forget: (id) => patch((s) => ({ ...s, memories: s.memories.filter((m) => m.id !== id) })),
      clearMemories: () => patch((s) => ({ ...s, memories: [] })),

      resetAll: () => {
        localStorage.removeItem(KEY)
        setState(freshState())
      },

      importState: (raw) => {
        try {
          const parsed = JSON.parse(raw) as AppState
          if (!parsed || !Array.isArray(parsed.recipes) || !Array.isArray(parsed.plan)) return false
          setState({ ...freshState(), ...parsed, version: VERSION })
          return true
        } catch {
          return false
        }
      },
    }
  }, [state, recipeMap, days, scoped, activeProfile, patch])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
