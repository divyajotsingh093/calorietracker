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
import type { AppState, MealSlot, PhotoLog, PlanEntry, Recipe, Settings } from '@/types'

const KEY = 'nourish.state.v1'
const VERSION = 1

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

const DEFAULT_SETTINGS: Settings = {
  name: '',
  calorieGoal: 2100,
  proteinGoal: 140,
  carbGoal: 220,
  fatGoal: 70,
  apiKey: '',
}

/** A sensible starter fortnight so the app is never an empty grid. */
function seedPlan(anchor: string): PlanEntry[] {
  const bySlot: Record<MealSlot, string[]> = {
    breakfast: ['r-overnight-oats', 'r-veggie-scramble', 'r-smoothie-bowl', 'r-avocado-toast', 'r-yoghurt-parfait', 'r-banana-pancakes', 'r-shakshuka'],
    lunch: ['r-chicken-burrito-bowl', 'r-mediterranean-quinoa', 'r-lentil-soup', 'r-caprese-panini', 'r-chickpea-wrap', 'r-tuna-poke', 'r-mediterranean-quinoa'],
    dinner: ['r-salmon-traybake', 'r-thai-green-curry', 'r-turkey-meatballs', 'r-tofu-bibimbap', 'r-fish-tacos', 'r-beef-stirfry', 'r-roast-chicken'],
    snack: ['r-hummus-plate', 'r-energy-balls', 'r-hummus-plate', 'r-energy-balls', 'r-yoghurt-parfait', 'r-energy-balls', 'r-hummus-plate'],
  }
  const entries: PlanEntry[] = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(anchor, i)
    for (const slot of ['breakfast', 'lunch', 'dinner', 'snack'] as MealSlot[]) {
      entries.push({
        id: uid(),
        date,
        slot,
        recipeId: bySlot[slot][i],
        servings: slot === 'snack' ? 1 : 1,
        eaten: false,
      })
    }
  }
  return entries
}

function freshState(): AppState {
  const anchor = currentMondayISO()
  return {
    version: VERSION,
    settings: DEFAULT_SETTINGS,
    recipes: SEED_RECIPES,
    plan: seedPlan(anchor),
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
    // Merge so new seed recipes and new settings fields appear after an update.
    const custom = (parsed.recipes ?? []).filter((r) => r.custom)
    const edited = new Map((parsed.recipes ?? []).filter((r) => !r.custom).map((r) => [r.id, r]))
    return {
      ...base,
      ...parsed,
      version: VERSION,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
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
  setSettings: (patch: Partial<Settings>) => void
  setAnchor: (iso: string) => void
  addPlanEntry: (date: string, slot: MealSlot, recipeId: string, servings?: number) => void
  removePlanEntry: (id: string) => void
  updatePlanEntry: (id: string, patch: Partial<PlanEntry>) => void
  toggleEaten: (id: string) => void
  movePlanEntry: (id: string, date: string, slot: MealSlot) => void
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

  const recipeMap = useMemo(
    () => new Map(state.recipes.map((r) => [r.id, r])),
    [state.recipes],
  )

  const api = useMemo<Store>(() => {
    const weekDates = (s: AppState, week: 0 | 1) =>
      Array.from({ length: 7 }, (_, i) => addDays(s.anchor, week * 7 + i))

    return {
      state,
      recipeMap,
      days,

      setSettings: (p) => patch((s) => ({ ...s, settings: { ...s.settings, ...p } })),
      setAnchor: (iso) => patch((s) => ({ ...s, anchor: iso })),

      addPlanEntry: (date, slot, recipeId, servings = 1) =>
        patch((s) => ({
          ...s,
          plan: [...s.plan, { id: uid(), date, slot, recipeId, servings, eaten: false }],
        })),

      removePlanEntry: (id) => patch((s) => ({ ...s, plan: s.plan.filter((e) => e.id !== id) })),

      updatePlanEntry: (id, p) =>
        patch((s) => ({ ...s, plan: s.plan.map((e) => (e.id === id ? { ...e, ...p } : e)) })),

      toggleEaten: (id) =>
        patch((s) => ({
          ...s,
          plan: s.plan.map((e) => (e.id === id ? { ...e, eaten: !e.eaten } : e)),
        })),

      movePlanEntry: (id, date, slot) =>
        patch((s) => ({
          ...s,
          plan: s.plan.map((e) => (e.id === id ? { ...e, date, slot } : e)),
        })),

      copyDay: (from, to) =>
        patch((s) => {
          const source = s.plan.filter((e) => e.date === from)
          const kept = s.plan.filter((e) => e.date !== to)
          return {
            ...s,
            plan: [...kept, ...source.map((e) => ({ ...e, id: uid(), date: to, eaten: false }))],
          }
        }),

      clearDay: (date) => patch((s) => ({ ...s, plan: s.plan.filter((e) => e.date !== date) })),

      copyWeek: (fromWeek, toWeek) =>
        patch((s) => {
          const from = weekDates(s, fromWeek)
          const to = weekDates(s, toWeek)
          const map = new Map(from.map((d, i) => [d, to[i]]))
          const source = s.plan.filter((e) => map.has(e.date))
          const kept = s.plan.filter((e) => !to.includes(e.date))
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
          return { ...s, plan: s.plan.filter((e) => !dates.includes(e.date)) }
        }),

      saveRecipe: (recipe) =>
        patch((s) => ({
          ...s,
          recipes: s.recipes.some((r) => r.id === recipe.id)
            ? s.recipes.map((r) => (r.id === recipe.id ? recipe : r))
            : [...s.recipes, recipe],
        })),

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
  }, [state, recipeMap, days, patch])

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}
