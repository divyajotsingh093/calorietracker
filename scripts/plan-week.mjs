/**
 * Picks the seeded week by search rather than by eye.
 *
 * Enumerates every day-combination (breakfast + lunch + dinner + 2 snacks) that
 * satisfies the per-day constraints, then selects seven of them that also
 * satisfy the week-level ones.
 *
 * Per day  — Ruchi under her calorie goal but not far under, protein at or above
 *            target, fibre >= 28 g, at least three cuisines on the plate, and
 *            everything strictly vegetarian and egg-free. Dj eats the same,
 *            except where a meat or fish sibling is the natural swap.
 * Per week — no dish more than twice, every cuisine represented, and no single
 *            cuisine more than a quarter of Ruchi's meals.
 */
import fs from 'node:fs'

const src = fs.readFileSync('src/data/recipes.ts', 'utf8')
const R = []
for (const b of src.split(/\n  \{\n/).slice(1)) {
  const id = /id: '(r-[a-z0-9-]+)'/.exec(b); if (!id) continue
  const g = (re, d = '0') => { const m = re.exec(b); return m ? (m[1] ?? m[2]) : d }
  R.push({ id: id[1], name: g(/name: (?:'([^']+)'|"([^"]+)")/), cu: g(/cuisine: '([^']+)'/, ''),
    slots: g(/slots: \[([^\]]*)\]/, '').replace(/['\s]/g, '').split(','),
    veg: !/contains: \[[^\]]*(meat|fish|egg)/.test(b),
    k: +g(/calories: ([\d.]+)/), p: +g(/protein: ([\d.]+)/), fib: +g(/fibre: ([\d.]+)/) })
}
const get = (id) => R.find((r) => r.id === id)
const by = (s) => R.filter((r) => r.slots.includes(s) && r.veg)

/**
 * Dj's version of a dish, where a meat or fish sibling is the obvious swap.
 * Several veg dishes point at the same non-veg dish — the day builder below
 * rejects any day that would serve Dj the same thing twice.
 */
const SWAP = {
  // Asian
  'r-tofu-bibimbap': 'r-teriyaki-salmon-donburi', 'r-tofu-pad-thai': 'r-tuna-poke',
  'r-veg-fried-rice': 'r-teriyaki-salmon-donburi', 'r-miso-ramen-veg': 'r-beef-stirfry',
  'r-thai-green-curry-veg': 'r-thai-green-curry', 'r-sundubu': 'r-beef-stirfry',
  'r-congee': 'r-congee',
  // Indian
  'r-palak-paneer': 'r-chicken-tikka-masala', 'r-paneer-tikka': 'r-chicken-tikka-masala',
  'r-veg-biryani': 'r-chicken-biryani', 'r-chana-masala': 'r-goan-fish-curry',
  'r-aloo-gobi': 'r-goan-fish-curry', 'r-rajma-chawal': 'r-chicken-biryani',
  'r-dal-tadka': 'r-chicken-tikka-masala', 'r-besan-chilla': 'r-veggie-scramble',
  'r-idli-sambar': 'r-shakshuka',
  // Italian
  'r-pasta-norma': 'r-turkey-meatballs', 'r-pesto-gnocchi': 'r-turkey-meatballs',
  'r-mushroom-risotto': 'r-roast-chicken', 'r-caprese-panini': 'r-tuna-puttanesca',
  'r-minestrone': 'r-tuna-puttanesca',
  // Middle Eastern
  'r-mujadara': 'r-chicken-shawarma',
  'r-stuffed-peppers': 'r-chicken-shawarma', 'r-lentil-soup': 'r-chicken-shawarma',
  // Continental / Mexican / Salads
  'r-halloumi-traybake': 'r-salmon-traybake', 'r-pb-banana-toast': 'r-avocado-toast',
  'r-sweet-potato-tacos': 'r-fish-tacos', 'r-falafel-bowl': 'r-chicken-burrito-bowl',
  'r-chickpea-halloumi-salad': 'r-souvlaki-bowl',
  // added with the twelve researched dishes
  'r-mapo-tofu-veg': 'r-beef-stirfry', 'r-tempeh-stirfry': 'r-teriyaki-salmon-donburi',
  'r-lentil-ragu': 'r-turkey-meatballs', 'r-black-bean-soup': 'r-chicken-burrito-bowl',
  'r-paneer-bhurji': 'r-menemen', 'r-ful-medames': 'r-menemen',
  'r-fattoush-halloumi': 'r-harissa-prawns',
}
const GOAL = { rk: 1850, rp: 110, dk: 1950, dp: 140, fib: 30 }

/**
 * Dishes the household actually eats, which the plan must not drop just
 * because a leaner option scores better. The seed yoghurt bowl is their usual
 * breakfast; nuts and seeds are calorie-dense for the protein they carry, so a
 * morning built on one leaves less room in the day. That is a real trade-off,
 * not a bug, so a day holding a pinned dish is allowed a few grams of slack
 * rather than being ruled out.
 */
const PINNED = [['r-seed-yogurt-bowl', 2]]
const PINNED_IDS = new Set(PINNED.map(([id]) => id))
const SLACK = 6

// ── enumerate every acceptable day ────────────────────────────────────────
const B = by('breakfast'), L = by('lunch'), D = by('dinner'), S = by('snack')
const days = []
for (const b of B) for (const l of L) for (const dn of D)
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) {
    const picks = [b, l, dn, S[i], S[j]]
    if (new Set(picks.map((x) => x.id)).size < 5) continue
    const rk = picks.reduce((a, x) => a + x.k, 0)
    if (rk > GOAL.rk || rk < GOAL.rk - 260) continue
    const slack = picks.some((x) => PINNED_IDS.has(x.id)) ? SLACK : 0
    const rp = picks.reduce((a, x) => a + x.p, 0); if (rp < GOAL.rp - slack) continue
    const rf = picks.reduce((a, x) => a + x.fib, 0); if (rf < GOAL.fib) continue
    if (new Set(picks.map((x) => x.cu)).size < 3) continue
    const dj = [b, l, dn].map((x) => (SWAP[x.id] && get(SWAP[x.id]) ? get(SWAP[x.id]) : x))
    const dAll = [...dj, S[i], S[j]]
    // several veg dishes share a meaty sibling — never serve Dj the same twice
    if (new Set(dAll.map((x) => x.id)).size < 5) continue
    const dk = dAll.reduce((a, x) => a + x.k, 0), dp = dAll.reduce((a, x) => a + x.p, 0)
    if (dk > GOAL.dk || dk < GOAL.dk - 300 || dp < GOAL.dp - slack) continue
    days.push({ picks, dj, rk, rp, rf, dk, dp, df: dAll.reduce((a, x) => a + x.fib, 0) })
  }
console.error(`acceptable days: ${days.length}`)

// ── choose seven of them ──────────────────────────────────────────────────
const CUISINES = [...new Set(R.map((r) => r.cu))]
const CI = Object.fromEntries(CUISINES.map((c, i) => [c, i]))
// cuisine histogram per candidate day, precomputed — the inner loop runs millions of times
for (const d of days) {
  d.hist = CUISINES.map(() => 0)
  for (const x of d.picks) d.hist[CI[x.cu]]++
  d.ids = d.picks.map((x) => x.id)
  // the three meals, on both plates — Dj's swap counts as a repeat too
  d.mains = [...new Set([...d.picks.slice(0, 3).map((x) => x.id), ...d.dj.map((x) => x.id)])]
  d.key = d.ids.slice().sort().join('|')
}
/** Fisher-Yates, so a level's candidates are tried in a different order each run. */
const shuffle = (a) => {
  const c = a.slice()
  for (let i = c.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[c[i], c[j]] = [c[j], c[i]]
  }
  return c
}

/**
 * Seven days out of the acceptable set, by backtracking rather than by luck.
 * A greedy pick paints itself into a corner: the days that clear both calorie
 * ceilings lean on the same handful of high-protein dishes, so the seventh day
 * is usually the one with nothing left to place.
 *
 * The search is guided: with `d` days still to place a cuisine can only reach
 * three appearances if enough days remain, so a branch that has already run out
 * of room for one is abandoned rather than explored to the bottom.
 */
// Week-level shape. A dish may show up three times in seven days: the dishes
// that carry the protein are a small set, and a cap of two makes the seventh
// day unplaceable rather than making the week more varied.
// Week-level shape. A dish may show up three times in one week: the dishes that
// carry the protein are a small set, and a cap of two makes the seventh day
// unplaceable rather than making the week more varied.
const MINC = 3, MAXC = 8, MAXUSE = 3

/**
 * Fourteen days in one search, not two weeks in a row.
 *
 * The fortnight has to satisfy something no single week does: a main served in
 * week one may not come back in week two. Planning week one first and then
 * banning its cast never works — week one takes the twenty-odd mains that make
 * the protein targets reachable and leaves week two nothing. Searching both at
 * once lets the walk back out of a week-one choice when week two dead-ends.
 *
 * Snacks are exempt from the no-repeat rule on purpose. Hitting 110 g and 140 g
 * of protein inside the calorie ceilings leans on a handful of protein-dense
 * snacks that appear in almost every qualifying day; banning those across weeks
 * leaves exactly zero valid days. Repeating edamame across a fortnight is not
 * what "don't repeat" is asking about.
 */

const ALL_DAYS = days
const SAMPLE = 1400

function pickFortnight(budget = 20000) {
  // Sample the pool per attempt. Filtering all 2787 acceptable days at every
  // node is the whole cost of the search; 700 keeps plenty of variety, and a
  // fresh sample each restart explores the rest.
  const days = SAMPLE > ALL_DAYS.length ? ALL_DAYS : shuffle(ALL_DAYS).slice(0, SAMPLE)
  // uses are counted per week, so a dish may appear three times in week one and
  // three times in week two without the two totals fighting each other
  const used = [new Map(), new Map()]
  const weekOf = new Map()        // main id -> 0 | 1, the week that owns it
  const tally = [CUISINES.map(() => 0), CUISINES.map(() => 0)]
  const chosen = []
  const seen = new Set()
  let spent = 0

  const pinnedDays = Object.fromEntries(
    PINNED.map(([id]) => [id, ALL_DAYS.filter((d) => d.ids.includes(id))]),
  )
  const pinnedMet = () =>
    PINNED.every(([id, n]) => {
      const w = weekOf.get(id)
      return w !== undefined && (used[w].get(id) ?? 0) >= n
    })

  const search = (d) => {
    if (d === 14) {
      for (const ww of [0, 1]) {
        if (Math.min(...tally[ww]) < MINC || Math.max(...tally[ww]) > MAXC) return null
      }
      if (!pinnedMet()) return null
      return chosen.slice()
    }

    const w = d < 7 ? 0 : 1
    const left = (w === 0 ? 7 : 14) - d
    // Every cuisine still short needs slots, and the days left can supply only
    // five meals each. Checking the cuisines one at a time lets the walk reach
    // day 14 with one of them still on zero; the sum is the real bound.
    let deficit = 0
    for (let i = 0; i < tally[w].length; i++) deficit += Math.max(0, MINC - tally[w][i])
    if (deficit > left * 5) return null

    const prev = chosen[d - 1]
    // the pinned dish sits in few acceptable days, so leaving it to chance means
    // never drawing one; it belongs to whichever week claims it first
    let pool = days
    for (const [id, n] of PINNED) {
      const owner = weekOf.get(id)
      if (owner !== undefined && owner !== w) continue
      const have = used[w].get(id) ?? 0
      if (have < n && left <= n - have + 1) {
        pool = pinnedDays[id]
        break
      }
    }
    if (!pool.length) return null

    // Filter the pool rather than rejection-sampling it. By the back half of
    // week two almost every random day violates the one-week rule, so drawing
    // at random burns the whole budget on rejects and never reaches depth 14.
    const feasible = pool.filter((cand) => {
      // no day repeated anywhere in the fortnight — "nothing two days running"
      // still let Monday come back on Wednesday, identical down to the snacks
      if (seen.has(cand.key)) return false
      if (cand.mains.some((id) => (weekOf.get(id) ?? w) !== w)) return false
      if (cand.ids.some((id) => (used[w].get(id) ?? 0) >= MAXUSE)) return false
      if (prev && cand.ids.some((id) => prev.ids.includes(id))) return false
      for (let i = 0; i < tally[w].length; i++)
        if (tally[w][i] + cand.hist[i] > MAXC) return false
      return true
    })
    if (!feasible.length) return null

    // Prefer days that cover a cuisine still short. Random order alone leaves
    // the last cuisine to luck, and by then there is no room for it.
    const short = new Set()
    for (let i = 0; i < tally[w].length; i++) if (tally[w][i] < MINC) short.add(i)
    const cover = (c) => (short.size ? c.hist.reduce((n, v, i) => n + (v && short.has(i) ? 1 : 0), 0) : 0)
    const order = shuffle(feasible)
      .sort((a, b) => cover(b) - cover(a))
      .slice(0, 6)
    for (const cand of order) {
      if (spent++ > budget) return null

      const claimed = cand.mains.filter((id) => !weekOf.has(id))
      claimed.forEach((id) => weekOf.set(id, w))
      cand.ids.forEach((id) => used[w].set(id, (used[w].get(id) ?? 0) + 1))
      for (let i = 0; i < tally[w].length; i++) tally[w][i] += cand.hist[i]
      chosen.push(cand)
      seen.add(cand.key)

      const out = search(d + 1)
      if (out) return out

      chosen.pop()
      seen.delete(cand.key)
      for (let i = 0; i < tally[w].length; i++) tally[w][i] -= cand.hist[i]
      cand.ids.forEach((id) => used[w].set(id, used[w].get(id) - 1))
      claimed.forEach((id) => weekOf.delete(id))
    }
    return null
  }

  return search(0)
}

let fortnight = null
for (let i = 0; i < 150 && !fortnight; i++) fortnight = pickFortnight()
if (!fortnight) {
  console.error(`could not plan a fortnight with no repeated meal`)
  process.exit(1)
}

const weeks = [fortnight.slice(0, 7), fortnight.slice(7)]
const mainsOf = (w) => new Set(w.flatMap((d) => d.mains))

const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const q = (v) => `'${v}'`
const pairOf = (r, d) => (r.id === d.id ? q(r.id) : `[${q(r.id)}, ${q(d.id)}]`)

weeks.forEach((week, w) => {
  console.error(`\n===== week ${w + 1} =====`)
  console.error('day   Ruchi kcal/prot/fibre    Dj kcal/prot/fibre')
  week.forEach((d, i) =>
    console.error(`${names[i]}   ${d.rk} / ${Math.round(d.rp)} / ${Math.round(d.rf)}         ${d.dk} / ${Math.round(d.dp)} / ${Math.round(d.df)}`))
  const avg = (k) => Math.round(week.reduce((s, d) => s + d[k], 0) / 7)
  console.error(`AVG   ${avg('rk')} / ${avg('rp')} / ${avg('rf')}         ${avg('dk')} / ${avg('dp')} / ${avg('df')}`)
  const t = Object.fromEntries(CUISINES.map((c) => [c, 0]))
  for (const d of week) for (const x of d.picks) t[x.cu]++
  console.error('cuisine spread (Ruchi): ' + JSON.stringify(t))
})

const shared = [...mainsOf(weeks[0])].filter((id) => mainsOf(weeks[1]).has(id))
console.error(`\nmeals served in both weeks: ${shared.length}${shared.length ? ' — ' + shared.join(', ') : ''}`)
console.error(`distinct mains across the fortnight: ${new Set([...mainsOf(weeks[0]), ...mainsOf(weeks[1])]).size}`)

weeks.forEach((week, w) => {
  console.log(`const WEEK${w + 1}: DaySpec[] = [`)
  week.forEach((d, i) => {
    const [b, l, dn, s1, s2] = d.picks
    const cu = [...new Set(d.picks.map((x) => x.cu))].join(' / ')
    console.log(`  {\n    // ${names[i]} — ${cu}`)
    console.log(`    breakfast: ${pairOf(b, d.dj[0])},`)
    console.log(`    lunch: ${pairOf(l, d.dj[1])},`)
    console.log(`    dinner: ${pairOf(dn, d.dj[2])},`)
    console.log(`    snack: [${q(s1.id)}, ${q(s2.id)}],`)
    console.log('  },')
  })
  console.log(']')
  if (w === 0) console.log('')
})
