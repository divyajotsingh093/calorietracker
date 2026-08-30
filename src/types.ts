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

export type Cuisine =
  | 'Indian'
  | 'Asian'
  | 'Middle Eastern'
  | 'Italian'
  | 'Continental'
  | 'Mexican'
  | 'Salads'

/** What a dish contains, for diet filtering. Dairy is tracked but allowed. */
export type Contains = 'meat' | 'fish' | 'egg' | 'dairy'

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
  cuisine: Cuisine
  slots: MealSlot[]
  /** Empty means suitable for everyone, including egg-free vegetarians. */
  contains: Contains[]
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
  /** A cooking video for the dish, found by searching and kept editable. */
  video?: string
  /** Title of that video, so you can see what you are opening. */
  videoTitle?: string
  custom?: boolean
}

/** `vegetarian` here means ovo-free: no meat, no fish, no egg. */
export type Diet = 'vegetarian' | 'omnivore'

export interface Profile {
  id: string
  name: string
  emoji: string
  /** Tailwind classes for the avatar chip. */
  accent: string
  diet: Diet
  calorieGoal: number
  proteinGoal: number
  carbGoal: number
  fatGoal: number
}

export interface PlanEntry {
  id: string
  profileId: string
  /** yyyy-mm-dd */
  date: string
  slot: MealSlot
  recipeId: string
  servings: number
  eaten: boolean
}

export interface PhotoLog {
  id: string
  profileId: string
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

/** Where photo analysis runs. `offline` uses the bundled food table only. */
export type VisionProvider = 'offline' | 'anthropic' | 'openrouter'

export interface Settings {
  visionProvider: VisionProvider
  /** Anthropic key — stays in this browser, sent only to api.anthropic.com. */
  apiKey: string
  /** OpenRouter key — stays in this browser, sent only to openrouter.ai. */
  openrouterKey: string
  /** OpenRouter model slug, e.g. "anthropic/claude-sonnet-4.5". */
  openrouterModel: string
}

/** Which profile the app is currently showing. */
export type Scope = string | 'both'

export interface AppState {
  version: number
  settings: Settings
  profiles: Profile[]
  scope: Scope
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
