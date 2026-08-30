export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type Aisle =
  | 'Produce'
  | 'Meat & Seafood'
  | 'Dairy & Eggs'
  | 'Bakery'
  | 'Pantry'
  | 'Frozen'
  | 'Spices'
  | 'Other'

export interface Ingredient {
  /** Canonical shopping name, e.g. "rolled oats" */
  item: string
  qty: number
  unit: string
  aisle: Aisle
}

export interface Recipe {
  id: string
  name: string
  emoji: string
  slots: MealSlot[]
  /** Per single serving */
  calories: number
  protein: number
  carbs: number
  fat: number
  minutes: number
  servings: number
  tags: string[]
  /** Quantities are for `servings` servings */
  ingredients: Ingredient[]
  steps: string[]
  link?: string
  linkLabel?: string
  custom?: boolean
}

export interface PlanEntry {
  id: string
  /** yyyy-mm-dd */
  date: string
  slot: MealSlot
  recipeId: string
  servings: number
  eaten: boolean
}

export interface PhotoLog {
  id: string
  date: string
  slot: MealSlot
  /** data: URL of the (downscaled) captured photo */
  image?: string
  label: string
  calories: number
  protein: number
  carbs: number
  fat: number
  source: 'ai' | 'estimate' | 'manual'
  note?: string
  createdAt: number
}

export interface Settings {
  name: string
  calorieGoal: number
  proteinGoal: number
  carbGoal: number
  fatGoal: number
  /** Optional Anthropic API key for real photo analysis; stays in this browser. */
  apiKey: string
}

export interface AppState {
  version: number
  settings: Settings
  recipes: Recipe[]
  plan: PlanEntry[]
  photos: PhotoLog[]
  /** yyyy-mm-dd (a Monday) — first day of the visible 2-week window */
  anchor: string
  /** Grocery items checked off, keyed `${weekIndex}|${item}` */
  checked: string[]
  /** Extra one-off grocery items, keyed by week index */
  extras: { id: string; week: number; text: string }[]
}
