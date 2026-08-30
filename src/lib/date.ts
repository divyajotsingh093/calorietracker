export const DAY_MS = 86_400_000

export function toISO(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISO(new Date())
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const shift = (c.getDay() + 6) % 7
  c.setDate(c.getDate() - shift)
  return c
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function currentMondayISO(): string {
  return toISO(startOfWeek(new Date()))
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function dayName(iso: string): string {
  return DAY_NAMES[(fromISO(iso).getDay() + 6) % 7]
}

export function dayNum(iso: string): number {
  return fromISO(iso).getDate()
}

export function shortDate(iso: string): string {
  const d = fromISO(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function longDate(iso: string): string {
  const d = fromISO(iso)
  return `${DAY_NAMES[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function rangeLabel(startISO: string, days: number): string {
  return `${shortDate(startISO)} – ${shortDate(addDays(startISO, days - 1))}`
}

export function isWeekend(iso: string): boolean {
  const g = fromISO(iso).getDay()
  return g === 0 || g === 6
}

/** The 14 dates of the two-week window that starts at `anchor`. */
export function fortnight(anchor: string): string[] {
  return Array.from({ length: 14 }, (_, i) => addDays(anchor, i))
}
