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
  MealSlot,
  PhotoLog,
  PlanEntry,
  Profile,
  Recipe,
  Scope,
  Settings,
} from '@/types'

const KEY = 'nourish.state.v2'
const VERSION = 3

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
 * A starter week, Monday first, chosen by `scripts/plan-week.mjs` rather than by
 * eye: every day clears its protein target inside its calorie budget, carries
 * at least 30 g of fibre, spans at least three cuisines, repeats nothing from
 * the day before, and keeps Ruchi's column strictly vegetarian and egg-free.
 * Dj eats the same food except where a meat or fish sibling is the natural swap.
 *
 * The seed yoghurt bowl is pinned to two mornings — it is what they actually
 * eat, and a plan that optimises it away is answering the wrong question.
 *
 * As seeded: Ruchi averages 1807 kcal with 110 g protein and 54 g fibre;
 * Dj averages 1892 kcal with 141 g protein and 49 g fibre.
 */
const WEEK: DaySpec[] = [
  {
    // Mon — Continental / Indian / Middle Eastern / Asian
    breakfast: 'r-smoothie-bowl',
    lunch: 'r-soya-keema',
    dinner: ['r-stuffed-peppers', 'r-chicken-shawarma'],
    snack: ['r-edamame', 'r-berry-protein-smoothie'],
  },
  {
    // Tue — Indian / Mexican / Salads / Italian
    breakfast: 'r-dhokla',
    lunch: ['r-palak-paneer', 'r-chicken-tikka-masala'],
    dinner: ['r-black-bean-soup', 'r-chicken-burrito-bowl'],
    snack: ['r-sesame-slaw', 'r-white-bean-dip'],
  },
  {
    // Wed — Continental / Asian / Middle Eastern / Mexican
    breakfast: 'r-overnight-oats',
    lunch: ['r-mapo-tofu-veg', 'r-beef-stirfry'],
    dinner: ['r-lentil-soup', 'r-chicken-shawarma'],
    snack: ['r-tzatziki', 'r-black-bean-dip'],
  },
  {
    // Thu — Continental / Salads / Middle Eastern / Asian / Italian
    breakfast: 'r-seed-yogurt-bowl',
    lunch: 'r-sesame-slaw',
    dinner: ['r-stuffed-peppers', 'r-chicken-shawarma'],
    snack: ['r-edamame', 'r-bruschetta'],
  },
  {
    // Fri — Indian / Asian / Middle Eastern / Continental
    breakfast: ['r-paneer-bhurji', 'r-menemen'],
    lunch: ['r-miso-ramen-veg', 'r-beef-stirfry'],
    dinner: ['r-lentil-soup', 'r-chicken-shawarma'],
    snack: ['r-berry-protein-smoothie', 'r-moong-chaat'],
  },
  {
    // Sat — Continental / Salads / Asian / Mexican
    breakfast: 'r-seed-yogurt-bowl',
    lunch: 'r-sesame-slaw',
    dinner: ['r-chickpea-halloumi-salad', 'r-souvlaki-bowl'],
    snack: ['r-edamame', 'r-guacamole'],
  },
  {
    // Sun — Asian / Middle Eastern / Italian / Mexican
    breakfast: 'r-congee',
    lunch: ['r-mapo-tofu-veg', 'r-beef-stirfry'],
    dinner: ['r-stuffed-peppers', 'r-chicken-shawarma'],
    snack: ['r-white-bean-dip', 'r-black-bean-dip'],
  },
]

function seedPlan(anchor: string, profiles: Profile[]): PlanEntry[] {
  const entries: PlanEntry[] = []
  const push = (date: string, slot: MealSlot, pick: Pick) => {
    profiles.forEach((profile, i) => {
      const recipeId = Array.isArray(pick) ? pick[Math.min(i, pick.length - 1)] : pick
      entries.push({ id: uid(), profileId: profile.id, date, slot, recipeId, servings: 1, eaten: false })
    })
  }
  WEEK.forEach((day, i) => {
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
  toggleChecked: (key: string) => void
  clearChecked: (week: number) => void
  addExtra: (week: number, text: string) => void
  removeExtra: (id: string) => void
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
