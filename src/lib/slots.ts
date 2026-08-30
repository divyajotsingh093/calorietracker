import type { MealSlot } from '@/types'

export const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

/**
 * Each slot carries a CSS custom property rather than a fixed Tailwind hue,
 * so the wash re-tunes itself for whichever theme is active.
 */
export const SLOT_META: Record<
  MealSlot,
  { label: string; emoji: string; tint: string; time: string }
> = {
  breakfast: { label: 'Breakfast', emoji: '🌅', tint: 'var(--slot-breakfast)', time: '7–9am' },
  lunch: { label: 'Lunch', emoji: '☀️', tint: 'var(--slot-lunch)', time: '12–2pm' },
  dinner: { label: 'Dinner', emoji: '🌙', tint: 'var(--slot-dinner)', time: '7–9pm' },
  snack: { label: 'Snack', emoji: '🍎', tint: 'var(--slot-snack)', time: 'anytime' },
}

/** Inline style that drives the `wash` utility and the slot dot. */
export const tintStyle = (tint: string) => ({ '--tint': tint }) as React.CSSProperties
