import type { MealSlot } from '@/types'

export const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const SLOT_META: Record<
  MealSlot,
  { label: string; emoji: string; accent: string; ring: string; dot: string; time: string }
> = {
  breakfast: {
    label: 'Breakfast',
    emoji: '🌅',
    accent: 'from-amber-300/20 to-orange-400/5',
    ring: 'ring-amber-300/25',
    dot: 'bg-amber-300',
    time: '7–9am',
  },
  lunch: {
    label: 'Lunch',
    emoji: '☀️',
    accent: 'from-lime-300/20 to-emerald-400/5',
    ring: 'ring-lime-300/25',
    dot: 'bg-lime-300',
    time: '12–2pm',
  },
  dinner: {
    label: 'Dinner',
    emoji: '🌙',
    accent: 'from-sky-300/20 to-indigo-400/5',
    ring: 'ring-sky-300/25',
    dot: 'bg-sky-300',
    time: '7–9pm',
  },
  snack: {
    label: 'Snack',
    emoji: '🍎',
    accent: 'from-fuchsia-300/20 to-rose-400/5',
    ring: 'ring-fuchsia-300/25',
    dot: 'bg-fuchsia-300',
    time: 'anytime',
  },
}
