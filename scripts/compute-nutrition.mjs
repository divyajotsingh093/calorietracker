/**
 * Derives every seed recipe's per-serving nutrition from its ingredient list
 * and writes the result back into src/data/recipes.ts.
 *
 *   node scripts/compute-nutrition.mjs          # report only
 *   node scripts/compute-nutrition.mjs --write  # rewrite recipes.ts
 *
 * Run this after changing any recipe's ingredients so the macros keep up.
 */
import fs from 'node:fs'
import { ING } from './ingredient-nutrition.mjs'

const FILE = 'src/data/recipes.ts'
const src = fs.readFileSync(FILE, 'utf8')

/** Grams for one `qty unit` of `item`. */
export function grams(item, qty, unit) {
  const e = ING[item]
  if (!e) throw new Error(`no nutrition data for "${item}"`)
  const u = unit.toLowerCase()
  if (u === 'g') return qty
  if (u === 'kg') return qty * 1000
  if (u === 'ml') return qty * (e.u?.ml ?? 1)
  if (u === 'l') return qty * (e.u?.l ?? 1000)
  const per = e.u?.[u]
  if (per == null) throw new Error(`"${item}" has no weight for unit "${unit}"`)
  return qty * per
}

const blocks = src.split(/(?=\n  \{\n)/)
const rows = []

for (const b of blocks) {
  const idm = /id: '(r-[a-z0-9-]+)'/.exec(b)
  if (!idm) continue
  const name = (/name: (?:'([^']+)'|"([^"]+)")/.exec(b) ?? [])[1] ?? /name: "([^"]+)"/.exec(b)[1]
  const servings = Number(/servings: (\d+)/.exec(b)[1])
  const ings = [...b.matchAll(/\{ item: (?:'([^']+)'|"([^"]+)"), qty: ([\d.]+), unit: '([^']+)'/g)]
  let kcal = 0, p = 0, c = 0, f = 0, fib = 0, weight = 0
  for (const m of ings) {
    const item = m[1] ?? m[2]
    const g = grams(item, Number(m[3]), m[4])
    const [k, pp, cc, ff, ffi] = ING[item].n
    const s = g / 100
    kcal += k * s; p += pp * s; c += cc * s; f += ff * s; fib += (ffi ?? 0) * s
    weight += g
  }
  rows.push({
    id: idm[1], name, servings,
    calories: Math.round(kcal / servings),
    protein: Math.round((p / servings) * 10) / 10,
    carbs: Math.round((c / servings) * 10) / 10,
    fat: Math.round((f / servings) * 10) / 10,
    fibre: Math.round((fib / servings) * 10) / 10,
    servingGrams: Math.round(weight / servings / 5) * 5,
    was: {
      calories: Number(/calories: ([\d.]+)/.exec(b)[1]),
      protein: Number(/protein: ([\d.]+)/.exec(b)[1]),
    },
  })
}

const pad = (s, n) => String(s).padStart(n)
console.log('dish                                  kcal  (was)   prot  (was)  carb   fat  fibre  portion')
for (const r of rows) {
  console.log(
    r.name.slice(0, 36).padEnd(38) +
      pad(r.calories, 4) + pad(`(${r.was.calories})`, 8) +
      pad(r.protein + 'g', 6) + pad(`(${r.was.protein})`, 7) +
      pad(r.carbs + 'g', 7) + pad(r.fat + 'g', 6) + pad(r.fibre + 'g', 6) +
      pad(r.servingGrams + 'g', 9),
  )
}
const density = rows.map((r) => ({ ...r, d: (r.protein / r.calories) * 1000 })).sort((a, b) => a.d - b.d)
console.log('\nlowest protein density (g per 1000 kcal):')
density.slice(0, 10).forEach((r) => console.log(`  ${pad(Math.round(r.d), 3)}  ${r.name}`))

if (process.argv.includes('--write')) {
  let out = src
  for (const r of rows) {
    const re = new RegExp(
      `(id: '${r.id}',[\\s\\S]*?)calories: [\\d.]+,\\n(\\s*)protein: [\\d.]+,\\n\\s*carbs: [\\d.]+,\\n\\s*fat: [\\d.]+,\\n(?:\\s*fibre: [\\d.]+,\\n)?(?:\\s*servingGrams: \\d+,\\n)?`,
    )
    if (!re.test(out)) { console.error('!! no macro block matched for', r.id); continue }
    out = out.replace(re, (_m, head, ind) =>
      `${head}calories: ${r.calories},\n${ind}protein: ${r.protein},\n${ind}carbs: ${r.carbs},\n${ind}fat: ${r.fat},\n${ind}fibre: ${r.fibre},\n${ind}servingGrams: ${r.servingGrams},\n`)
  }
  fs.writeFileSync(FILE, out)
  console.log(`\nwrote ${rows.length} recipes to ${FILE}`)
}
