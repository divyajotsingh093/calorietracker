import type { Aisle, PlanEntry, Recipe } from '@/types'

export const AISLE_ORDER: Aisle[] = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Bakery',
  'Pantry',
  'Frozen',
  'Spices',
  'Other',
]

/**
 * Aisle hues are stated as raw oklch so they read the same in both themes;
 * they only ever appear as a ~14% wash over the panel colour.
 */
export const AISLE_META: Record<Aisle, { emoji: string; tint: string }> = {
  Produce: { emoji: '🥬', tint: 'oklch(0.72 0.17 145)' },
  'Meat & Seafood': { emoji: '🥩', tint: 'oklch(0.68 0.18 20)' },
  'Dairy & Eggs': { emoji: '🥛', tint: 'oklch(0.72 0.13 240)' },
  Bakery: { emoji: '🍞', tint: 'oklch(0.78 0.14 78)' },
  Pantry: { emoji: '🥫', tint: 'oklch(0.72 0.16 52)' },
  Frozen: { emoji: '🧊', tint: 'oklch(0.75 0.12 210)' },
  Spices: { emoji: '🌶️', tint: 'oklch(0.68 0.18 330)' },
  Other: { emoji: '🧺', tint: 'oklch(0.66 0.03 268)' },
}

export interface GroceryLine {
  key: string
  item: string
  aisle: Aisle
  /** one entry per distinct unit, so `2 whole` and `150 g` never get summed */
  amounts: { qty: number; unit: string }[]
  /** dishes that need it */
  from: string[]
}

/** Pretty-print a quantity: trims float noise, keeps halves readable. */
export function fmtQty(qty: number): string {
  const rounded = Math.round(qty * 100) / 100
  if (Number.isInteger(rounded)) return String(rounded)
  return String(Math.round(rounded * 10) / 10)
}

/** Units you buy as whole things — you cannot put 0.4 of a lemon in the basket. */
const COUNTABLE = new Set([
  'whole', 'small', 'medium', 'large', 'bunch', 'head', 'bulb', 'clove', 'cloves',
  'stick', 'sticks', 'fillet', 'fillets', 'slice', 'slices', 'roll', 'rolls',
  'pack', 'packs', 'tin', 'tins', 'can', 'cans', 'jar', 'jars', 'sachet', 'sachets',
])

const ceilTo = (n: number, step: number) => Math.ceil(n / step - 1e-9) * step

/**
 * Round a needed amount up to something a shop actually sells. A plan that
 * needs a quarter of a chicken still puts one chicken in the basket.
 */
export function roundForPurchase(qty: number, unit: string): number {
  const u = unit.toLowerCase()
  if (COUNTABLE.has(u)) return Math.max(1, Math.ceil(qty - 1e-9))
  if (u === 'g' || u === 'ml') return qty >= 100 ? ceilTo(qty, 25) : ceilTo(qty, 10)
  if (u === 'kg' || u === 'l') return Math.round(ceilTo(qty, 0.25) * 100) / 100
  if (u === 'tbsp' || u === 'tsp') return Math.round(ceilTo(qty, 0.5) * 100) / 100
  return Math.round(qty * 100) / 100
}

/** "1 sticks" reads badly — drop the plural s when you only need one. */
function unitFor(qty: number, unit: string): string {
  if (qty !== 1) return unit
  const u = unit.toLowerCase()
  return COUNTABLE.has(u) && u.endsWith('s') ? unit.slice(0, -1) : unit
}

export function amountsLabel(amounts: { qty: number; unit: string }[]): string {
  return amounts
    .map((a) => {
      const qty = roundForPurchase(a.qty, a.unit)
      return `${fmtQty(qty)} ${unitFor(qty, a.unit)}`
    })
    .join(' + ')
}

/**
 * Roll the planned meals for `dates` into a de-duplicated shopping list.
 * Recipe quantities are stated for `recipe.servings`, so each planned serving
 * pulls a `servings / recipe.servings` share of every ingredient.
 */
export function buildGroceryList(
  dates: string[],
  plan: PlanEntry[],
  recipes: Map<string, Recipe>,
): GroceryLine[] {
  const lines = new Map<string, GroceryLine>()
  const dateSet = new Set(dates)

  for (const entry of plan) {
    if (!dateSet.has(entry.date)) continue
    const recipe = recipes.get(entry.recipeId)
    if (!recipe) continue
    const share = entry.servings / Math.max(1, recipe.servings)

    for (const ing of recipe.ingredients) {
      const key = `${ing.item.toLowerCase()}|${ing.unit.toLowerCase()}`
      const existing = lines.get(key)
      const qty = ing.qty * share
      if (existing) {
        existing.amounts[0].qty += qty
        if (!existing.from.includes(recipe.name)) existing.from.push(recipe.name)
      } else {
        lines.set(key, {
          key,
          item: ing.item,
          aisle: ing.aisle,
          amounts: [{ qty, unit: ing.unit }],
          from: [recipe.name],
        })
      }
    }
  }

  // Merge same item across different units into one row with multiple amounts.
  const byItem = new Map<string, GroceryLine>()
  for (const line of lines.values()) {
    const itemKey = line.item.toLowerCase()
    const existing = byItem.get(itemKey)
    if (existing) {
      existing.amounts.push(...line.amounts)
      for (const f of line.from) if (!existing.from.includes(f)) existing.from.push(f)
    } else {
      byItem.set(itemKey, { ...line, key: itemKey })
    }
  }

  return [...byItem.values()].sort(
    (a, b) =>
      AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle) ||
      a.item.localeCompare(b.item),
  )
}

export function groupByAisle(lines: GroceryLine[]): [Aisle, GroceryLine[]][] {
  const groups = new Map<Aisle, GroceryLine[]>()
  for (const l of lines) {
    const arr = groups.get(l.aisle) ?? []
    arr.push(l)
    groups.set(l.aisle, arr)
  }
  return AISLE_ORDER.filter((a) => groups.has(a)).map((a) => [a, groups.get(a)!])
}

export function listToText(lines: GroceryLine[], title: string, extras: string[]): string {
  const out = [title, '='.repeat(title.length), '']
  for (const [aisle, items] of groupByAisle(lines)) {
    out.push(`${AISLE_META[aisle].emoji}  ${aisle.toUpperCase()}`)
    for (const l of items) out.push(`  [ ] ${l.item} — ${amountsLabel(l.amounts)}`)
    out.push('')
  }
  if (extras.length) {
    out.push('🧺  EXTRAS')
    for (const e of extras) out.push(`  [ ] ${e}`)
    out.push('')
  }
  return out.join('\n')
}
