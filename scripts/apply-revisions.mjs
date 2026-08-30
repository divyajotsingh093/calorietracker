/** Rewrites each recipe's ingredient list from recipe-revisions.mjs. */
import fs from 'node:fs'
import { REVISIONS } from './recipe-revisions.mjs'

const FILE = 'src/data/recipes.ts'
let src = fs.readFileSync(FILE, 'utf8')
let changed = 0, same = 0
const missing = []

for (const [id, list] of Object.entries(REVISIONS)) {
  const body = list
    .map(([item, qty, unit, aisle]) => {
      const name = item.includes("'") ? `"${item}"` : `'${item}'`
      return `      { item: ${name}, qty: ${qty}, unit: '${unit}', aisle: '${aisle}' },`
    })
    .join('\n')
  const re = new RegExp(`(id: '${id}',[\\s\\S]*?ingredients: \\[\\n)([\\s\\S]*?)(\\n    \\],)`)
  const m = re.exec(src)
  if (!m) { missing.push(id); continue }
  if (m[2] === body) { same++; continue }
  src = src.replace(re, (_x, head, _old, tail) => head + body + tail)
  changed++
}

fs.writeFileSync(FILE, src)
console.log(`ingredients: ${changed} updated, ${same} already current`)
if (missing.length) console.error('NO MATCH for:', missing.join(', '))
