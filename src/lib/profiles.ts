import type { Contains, Diet, Profile, Recipe } from '@/types'

export const DEFAULT_PROFILES: Profile[] = [
  {
    id: 'p-ruchi',
    name: 'Ruchi',
    emoji: '🌿',
    accent: 'from-fuchsia-400 to-rose-400',
    diet: 'vegetarian',
    calorieGoal: 1850,
    proteinGoal: 110,
    carbGoal: 210,
    fatGoal: 62,
    fibreGoal: 30,
    // pancakes are fine; a fried egg is not
    eggInBatter: true,
  },
  {
    id: 'p-dj',
    name: 'Dj',
    emoji: '🔥',
    accent: 'from-sky-400 to-indigo-400',
    diet: 'omnivore',
    // 1950 for meals plus the 358 kcal of eggs he eats every morning
    calorieGoal: 2250,
    proteinGoal: 140,
    carbGoal: 200,
    fatGoal: 65,
    fibreGoal: 30,
    // five boiled eggs, every day, without being asked about them
    staples: ['r-boiled-eggs'],
  },
]

const FORBIDDEN: Record<Diet, Contains[]> = {
  vegetarian: ['meat', 'fish', 'egg', 'egg-in-batter'],
  omnivore: [],
}

const WORD: Partial<Record<Contains, string>> = {
  meat: 'meat',
  fish: 'fish',
  egg: 'egg',
  'egg-in-batter': 'egg, even in a batter',
}

/** What a diet rules out for this person, allowing for their own exceptions. */
function forbidden(profile: Pick<Profile, 'diet' | 'eggInBatter'>): Contains[] {
  const base = FORBIDDEN[profile.diet]
  return profile.eggInBatter ? base.filter((c) => c !== 'egg-in-batter') : base
}

/**
 * Can this profile eat this dish?
 *
 * Takes the whole profile rather than the diet alone, because the diet is not
 * the whole rule: Ruchi is vegetarian and egg-free, and still eats pancakes.
 */
export function suitsProfile(recipe: Recipe, profile: Pick<Profile, 'diet' | 'eggInBatter'>): boolean {
  const no = forbidden(profile)
  return !recipe.contains.some((c) => no.includes(c))
}

/** The strict reading, for library filters that have no person in hand. */
export function suitsDiet(recipe: Recipe, diet: Diet): boolean {
  return !recipe.contains.some((c) => FORBIDDEN[diet].includes(c))
}

/** Why a dish is off-limits, for the warning shown when planning anyway. */
export function dietClash(recipe: Recipe, profile: Profile): string | null {
  const bad = recipe.contains.filter((c) => forbidden(profile).includes(c))
  if (!bad.length) return null
  return `${profile.name} doesn't eat ${bad.map((b) => WORD[b] ?? b).join(' or ')}.`
}

export function dietLabel(diet: Diet): string {
  return diet === 'vegetarian' ? 'Vegetarian · no egg' : 'Eats everything'
}
