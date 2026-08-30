/**
 * The proxy's allowlist and the app's catalogue have to agree.
 *
 * They live in different files because one runs on the server and one in the
 * browser, and a slug in only one of them fails in a way that is hard to read:
 * either the picker offers a model the proxy refuses, or the proxy pays for a
 * model nobody can select.
 */
import fs from 'node:fs'

const section = (file, start) => {
  const src = fs.readFileSync(file, 'utf8')
  const from = src.indexOf(start)
  if (from < 0) throw new Error(`${file}: could not find ${start}`)
  // the closing bracket at column zero, not the first `]` — the declaration
  // itself contains one, in `ModelOption[]`
  const to = src.indexOf('\n]', from)
  if (to < 0) throw new Error(`${file}: could not find the end of ${start}`)
  return src.slice(from, to)
}

const collect = (text, re, where) => {
  const found = [...text.matchAll(re)].map((m) => m[1])
  if (!found.length) throw new Error(`no slugs found in ${where}`)
  return new Set(found)
}

// a bare quoted slug per line in the proxy; `slug: '...'` in the catalogue
const api = collect(
  section('api/openrouter.ts', 'const ALLOWED = new Set(['),
  /^\s*'([^'\n]+)',/gm,
  'api/openrouter.ts',
)
const app = collect(
  section('src/lib/models.ts', 'export const OPENROUTER_CATALOGUE'),
  /slug: '([^'\n]+)'/g,
  'src/lib/models.ts',
)

const onlyApi = [...api].filter((s) => !app.has(s))
const onlyApp = [...app].filter((s) => !api.has(s))

if (onlyApi.length || onlyApp.length) {
  if (onlyApi.length) console.error('in the proxy but not the app:\n  ' + onlyApi.join('\n  '))
  if (onlyApp.length) console.error('in the app but not the proxy:\n  ' + onlyApp.join('\n  '))
  process.exit(1)
}
console.log(`${api.size} models, and the proxy and the app agree on all of them`)
