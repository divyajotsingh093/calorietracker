import type { Contains, Diet, Profile, Recipe } from '@/types'

export const DEFAULT_PROFILES: Profile[] = [
  {
    id: 'p-ruchi',
    name: 'Ruchi',
    emoji: '🌿',
    accent: 'from-fuchsia-400 to-rose-400',
    diet: 'vegetarian',
    calorieGoal: 1850,
    proteinGoal: 90,
    carbGoal: 220,
    fatGoal: 60,
  },
  {
    id: 'p-dj',
    name: 'Dj',
    emoji: '🔥',
    accent: 'from-sky-400 to-indigo-400',
    diet: 'omnivore',
    calorieGoal: 1950,
    proteinGoal: 130,
    carbGoal: 210,
    fatGoal: 65,
  },
]

const FORBIDDEN: Record<Diet, Contains[]> = {
  vegetarian: ['meat', 'fish', 'egg'],
  omnivore: [],
}

/** Can this profile eat this dish? */
export function suitsDiet(recipe: Recipe, diet: Diet): boolean {
  return !recipe.contains.some((c) => FORBIDDEN[diet].includes(c))
}

/** Why a dish is off-limits, for the warning shown when planning anyway. */
export function dietClash(recipe: Recipe, profile: Profile): string | null {
  const bad = recipe.contains.filter((c) => FORBIDDEN[profile.diet].includes(c))
  if (!bad.length) return null
  const words = bad.map((b) => (b === 'egg' ? 'egg' : b === 'fish' ? 'fish' : 'meat'))
  return `${profile.name} doesn't eat ${words.join(' or ')}.`
}

export function dietLabel(diet: Diet): string {
  return diet === 'vegetarian' ? 'Vegetarian · no egg' : 'Eats everything'
}
