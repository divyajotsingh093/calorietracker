import { dayName, todayISO } from '@/lib/date'
import { dayTotals } from '@/lib/nutrition'
import type { PhotoLog, PlanEntry, Profile, Recipe } from '@/types'

/**
 * One day of one person's plan, with the macros restated as calories.
 *
 * The stacked column plots kcal rather than grams because that is the only
 * unit in which protein, carbs and fat add up to something — the day's energy.
 * A stack of grams would sum to a number that means nothing.
 */
export interface DayPoint {
  date: string
  /** 'Mon' */
  label: string
  today: boolean
  past: boolean
  calories: number
  proteinKcal: number
  carbsKcal: number
  fatKcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
}

export function daySeries(
  dates: string[],
  profile: Profile,
  plan: PlanEntry[],
  photos: PhotoLog[],
  recipes: Map<string, Recipe>,
): DayPoint[] {
  const today = todayISO()
  return dates.map((date) => {
    const m = dayTotals(date, profile.id, plan, photos, recipes, 'planned')
    return {
      date,
      label: dayName(date),
      today: date === today,
      past: date < today,
      calories: Math.round(m.calories),
      proteinKcal: m.protein * 4,
      carbsKcal: m.carbs * 4,
      fatKcal: m.fat * 9,
      protein: Math.round(m.protein),
      carbs: Math.round(m.carbs),
      fat: Math.round(m.fat),
      fibre: Math.round(m.fibre),
    }
  })
}

/** Mean of the days that actually have food on them. */
export function averages(points: DayPoint[]) {
  const real = points.filter((p) => p.calories > 0)
  const n = Math.max(1, real.length)
  const sum = (f: (p: DayPoint) => number) => real.reduce((a, p) => a + f(p), 0) / n
  return {
    days: real.length,
    calories: Math.round(sum((p) => p.calories)),
    protein: Math.round(sum((p) => p.protein)),
    carbs: Math.round(sum((p) => p.carbs)),
    fat: Math.round(sum((p) => p.fat)),
    fibre: Math.round(sum((p) => p.fibre)),
  }
}
