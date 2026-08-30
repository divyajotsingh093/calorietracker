export type ThemeMode = 'light' | 'dark' | 'system'
export type Accent = 'matcha' | 'citrus' | 'berry' | 'ocean' | 'grape'

export const ACCENTS: { id: Accent; name: string; blurb: string }[] = [
  { id: 'matcha', name: 'Matcha', blurb: 'Green tea and herbs' },
  { id: 'citrus', name: 'Citrus', blurb: 'Warm peel and honey' },
  { id: 'berry', name: 'Berry', blurb: 'Ripe plum and rose' },
  { id: 'ocean', name: 'Ocean', blurb: 'Deep blue and teal' },
  { id: 'grape', name: 'Grape', blurb: 'Violet and mulberry' },
]

const MODE_KEY = 'nourish.theme'
const ACCENT_KEY = 'nourish.accent'

export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode
  return typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function readMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* private mode, blocked storage — fall through to the default */
  }
  return 'system'
}

export function readAccent(): Accent {
  try {
    const v = localStorage.getItem(ACCENT_KEY) as Accent | null
    if (v && ACCENTS.some((a) => a.id === v)) return v
  } catch {
    /* as above */
  }
  return 'matcha'
}

/** Stamp the resolved theme on <html> so CSS can switch on it. */
export function applyTheme(mode: ThemeMode, accent: Accent) {
  const root = document.documentElement
  root.dataset.theme = resolveMode(mode)
  root.dataset.accent = accent
  root
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', resolveMode(mode) === 'dark' ? '#1b1d24' : '#faf9f5')
}

export function persistMode(mode: ThemeMode) {
  try {
    localStorage.setItem(MODE_KEY, mode)
  } catch {
    /* nothing to do — the theme still applies for this session */
  }
}

export function persistAccent(accent: Accent) {
  try {
    localStorage.setItem(ACCENT_KEY, accent)
  } catch {
    /* as above */
  }
}
