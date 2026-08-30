import type { PhotoLog, PlanEntry, Recipe } from '@/types'

export interface Macros {
  calories: number
  protein: number
  carbs: number
  fat: number
  fibre: number
}

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 }

export function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fibre: a.fibre + b.fibre,
  }
}

export function scaleMacros(m: Macros, factor: number): Macros {
  return {
    calories: m.calories * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
    fibre: m.fibre * factor,
  }
}

export function recipeMacros(r: Recipe): Macros {
  return {
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    fibre: r.fibre,
  }
}

export function entryMacros(entry: PlanEntry, recipes: Map<string, Recipe>): Macros {
  const r = recipes.get(entry.recipeId)
  if (!r) return ZERO
  return scaleMacros(recipeMacros(r), entry.servings)
}

/**
 * Totals for one date and one profile: planned meals + photo logs.
 * `mode` picks whether everything planned counts, or only what was ticked off.
 */
export function dayTotals(
  date: string,
  profileId: string,
  plan: PlanEntry[],
  photos: PhotoLog[],
  recipes: Map<string, Recipe>,
  mode: 'planned' | 'eaten',
): Macros {
  let total = ZERO
  for (const e of plan) {
    if (e.date !== date || e.profileId !== profileId) continue
    if (mode === 'eaten' && !e.eaten) continue
    total = addMacros(total, entryMacros(e, recipes))
  }
  for (const p of photos) {
    if (p.date !== date || p.profileId !== profileId) continue
    total = addMacros(total, p)
  }
  return total
}

export function round(n: number): number {
  return Math.round(n)
}

/** kcal split across the three macronutrients, as percentages. */
export function macroSplit(m: Macros): { protein: number; carbs: number; fat: number } {
  const kcal = m.protein * 4 + m.carbs * 4 + m.fat * 9
  if (kcal <= 0) return { protein: 0, carbs: 0, fat: 0 }
  return {
    protein: (m.protein * 4 * 100) / kcal,
    carbs: (m.carbs * 4 * 100) / kcal,
    fat: (m.fat * 9 * 100) / kcal,
  }
}
