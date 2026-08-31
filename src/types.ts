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

/**
 * What a dish contains, for diet filtering. Dairy is tracked but allowed.
 *
 * `egg-in-batter` is egg beaten into a mix and cooked through — pancakes, a
 * cake — as opposed to `egg`, which is egg you can see and taste as egg.
 * Ruchi eats the first and not the second, and one flag cannot express that.
 */
export type Contains = 'meat' | 'fish' | 'egg' | 'egg-in-batter' | 'dairy'

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
  /** Per single serving, computed from the ingredients by scripts/compute-nutrition.mjs */
  calories: number
  protein: number
  carbs: number
  fat: number
  fibre: number
  /** Weight of one serving in grams, so a portion is trackable */
  servingGrams: number
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
  /**
   * Set when the user edits a seed dish. Without it there is no way to tell a
   * dish they changed from one merely carried over from the last version, and
   * every update to the library gets discarded on load.
   */
  edited?: boolean
}

/**
 * `vegetarian` here means no meat, no fish, and no egg served as egg. Whether
 * egg baked into a batter is allowed is a per-person call — see
 * `Profile.eggInBatter`.
 */
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
  fibreGoal: number
  /**
   * Eats egg when it is beaten into a batter and cooked through, even though
   * they do not eat egg as egg. True for Ruchi, who has pancakes.
   */
  eggInBatter?: boolean
  /**
   * Dishes on this person's plate every single day, added to each date as it
   * comes into view rather than logged by hand. Dj's five boiled eggs are the
   * reason this exists: a constant is not news, and asking someone to record it
   * every morning is the app doing its job badly.
   */
  staples?: string[]
  /**
   * Slots the staples stand in for, so nothing is planned into them. Dj's five
   * eggs are his breakfast rather than something on top of it, so he gets no
   * planned breakfast dish at all — Ruchi still gets hers.
   */
  staplesReplace?: MealSlot[]
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
  fibre: number
  source: 'ai' | 'estimate' | 'manual'
  note?: string
  createdAt: number
}

/** Where photo analysis runs. `offline` uses the bundled food table only. */
export type VisionProvider = 'offline' | 'anthropic' | 'openrouter'

export interface Settings {
  visionProvider: VisionProvider
  /**
   * Whether a person actually picked that provider. Until they do, a deployment
   * carrying its own key is used automatically — but choosing On-device has to
   * mean no network calls, so an explicit choice is never overridden.
   */
  providerChosen?: boolean
  /** Anthropic key — stays in this browser, sent only to api.anthropic.com. */
  apiKey: string
  /** OpenRouter key — stays in this browser, sent only to openrouter.ai. */
  openrouterKey: string
  /** OpenRouter model slug for photo analysis — must accept image input. */
  openrouterModel: string
  /**
   * OpenRouter model slug for NOVA. Kept separate from the vision model
   * because the best assistants here are text-only: GLM 5.2 does tool calls
   * over a 1M-token context but cannot see a photograph.
   */
  openrouterChatModel: string
}

/** Which profile the app is currently showing. */
export type Scope = string | 'both'

/** One line of a NOVA conversation, kept so the thread survives a reload. */
export interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  text: string
  /** what the model actually changed on this turn */
  actions?: { name: string; detail: string; ok: boolean }[]
  /** the reply came from the on-device engine, not a model */
  local?: boolean
  error?: boolean
  at: number
}

/**
 * Something NOVA has been told to remember, carried into every later
 * conversation. Kept as plain sentences the user can read and delete, rather
 * than an opaque embedding — if the assistant is going to act on a belief about
 * the household, that belief has to be inspectable.
 */
export interface Memory {
  id: string
  text: string
  /** who put it there: NOVA noticed it, or you typed it */
  source: 'nova' | 'you'
  createdAt: number
}

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
  /** the running NOVA conversation */
  chat: ChatTurn[]
  /** what NOVA has learned about the household */
  memories: Memory[]
  /**
   * Dates whose staples have already been laid down, so removing one sticks
   * instead of reappearing the next time the date scrolls into view.
   */
  stapled: string[]
}
