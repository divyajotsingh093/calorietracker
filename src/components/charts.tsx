import { useId, useState } from 'react'
import { cx } from '@/components/ui'
import type { DayPoint } from '@/lib/series'

/**
 * Series colours for the HUD's dark surface.
 *
 * These are NOT the --hud-* accents. Those sit at OKLCH L 0.76–0.88, which is
 * above the band a dark-surface categorical palette needs; used as data marks
 * they read as glowing blocks and fail the lightness check. These three are
 * stepped into L 0.53–0.67 and validated against the panel colour: worst
 * adjacent pair 12.9 ΔE under deuteranopia, 27.9 under normal vision.
 *
 * The hues echo the rest of the app, where protein is blue, carbs green and
 * fat orange, so the same food reads the same way on every screen.
 */
export const MACRO = {
  protein: '#3280dd',
  carbs: '#42af4d',
  fat: '#bd321b',
} as const

export const MACRO_KEYS = ['protein', 'carbs', 'fat'] as const
export type MacroKey = (typeof MACRO_KEYS)[number]

const LABEL: Record<MacroKey, string> = {
  protein: 'Protein',
  carbs: 'Carbs',
  fat: 'Fat',
}

/** kcal per gram, so a stack of calories can be read back as grams. */
const GRAMS: Record<MacroKey, (p: DayPoint) => number> = {
  protein: (p) => p.protein,
  carbs: (p) => p.carbs,
  fat: (p) => p.fat,
}
const KCAL: Record<MacroKey, (p: DayPoint) => number> = {
  protein: (p) => p.proteinKcal,
  carbs: (p) => p.carbsKcal,
  fat: (p) => p.fatKcal,
}

/** Round a ceiling up to a clean axis number. */
export function niceMax(n: number): number {
  const step = n > 2000 ? 500 : 250
  return Math.max(step, Math.ceil(n / step) * step)
}

export interface ColumnsProps {
  points: DayPoint[]
  /** the person's calorie goal, drawn as a reference line */
  goal: number
  name: string
  /**
   * Shared y-axis ceiling. Two people side by side are only comparable on one
   * scale; letting each chart pick its own makes the shorter column of a bigger
   * eater look like the taller column of a smaller one.
   */
  max: number
}

/**
 * A day's energy, split by where it came from.
 *
 * Stacked because the segments genuinely sum to the total — the question
 * "am I eating enough protein?" is really "how much of the column is blue?",
 * which no pair of separate charts answers as directly.
 */
export function MacroColumns({ points, goal, name, max }: ColumnsProps) {
  const [hover, setHover] = useState<number | null>(null)
  const titleId = useId()

  const W = 320
  const H = 150
  const PAD = { t: 14, r: 8, b: 22, l: 34 }
  const plotW = W - PAD.l - PAD.r
  const plotH = H - PAD.t - PAD.b

  const y = (v: number) => PAD.t + plotH - (v / max) * plotH
  const band = plotW / Math.max(1, points.length)
  const barW = Math.min(24, band - 10)

  const ticks = [0, max / 2, max]
  const GAP = 2 // surface gap between stacked segments

  const active = hover === null ? null : points[hover]

  return (
    <figure className="m-0">
      <figcaption id={titleId} className="hud-label mb-1">
        {name} · energy by source, kcal a day
      </figcaption>

      <Readout point={active ?? points.find((p) => p.today) ?? points[points.length - 1]} live={Boolean(active)} />

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-labelledby={titleId}
          style={{ overflow: 'visible' }}
        >
          {/* recessive hairline grid */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--hud-line-soft)"
                strokeWidth={1}
              />
              <text
                x={PAD.l - 6}
                y={y(t) + 3}
                textAnchor="end"
                className="hud-num"
                fontSize="8"
                fill="var(--hud-faint)"
              >
                {t === 0 ? '0' : Math.round(t).toLocaleString()}
              </text>
            </g>
          ))}

          {/* the goal, as a reference line rather than a fourth series */}
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(goal)}
            y2={y(goal)}
            stroke="var(--hud-cyan)"
            strokeWidth={1}
            opacity={0.65}
          />
          {points.map((p, i) => {
            const cx0 = PAD.l + band * i + band / 2
            const x = cx0 - barW / 2
            let cursor = plotH + PAD.t
            const segs = MACRO_KEYS.map((k) => {
              const v = KCAL[k](p)
              const h = (v / max) * plotH
              const top = cursor - h
              cursor = top
              return { k, top, h }
            })
            const dim = hover !== null && hover !== i

            return (
              <g key={p.date} opacity={dim ? 0.42 : 1} style={{ transition: 'opacity .15s' }}>
                {segs.map(({ k, top, h }, si) => {
                  // the topmost segment carries the rounded cap; the rest are square
                  const isTop = si === segs.length - 1
                  const hh = Math.max(0, h - (si === 0 ? 0 : GAP))
                  if (hh <= 0) return null
                  return (
                    <rect
                      key={k}
                      x={x}
                      y={top + (si === 0 ? 0 : GAP)}
                      width={barW}
                      height={hh}
                      rx={isTop ? 4 : 0}
                      fill={MACRO[k]}
                    />
                  )
                })}
                {/* today gets the one direct label — never a number on every column */}
                {p.today && p.calories > 0 && (
                  <text
                    x={cx0}
                    y={y(p.calories) - 6}
                    textAnchor="middle"
                    className="hud-num"
                    fontSize="9"
                    fontWeight="600"
                    fill="var(--hud-ink)"
                  >
                    {p.calories.toLocaleString()}
                  </text>
                )}
                <text
                  x={cx0}
                  y={H - 6}
                  textAnchor="middle"
                  className="hud-num"
                  fontSize="8"
                  fill={p.today ? 'var(--hud-ink)' : 'var(--hud-faint)'}
                  fontWeight={p.today ? 600 : 400}
                >
                  {p.label}
                </text>
                {/* hit target is the whole band, not the painted bar */}
                <rect
                  x={PAD.l + band * i}
                  y={PAD.t}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${p.label}: ${p.calories} kcal, ${p.protein} g protein, ${p.carbs} g carbs, ${p.fat} g fat`}
                  onPointerEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onBlur={() => setHover(null)}
                  style={{ cursor: 'pointer', outline: 'none' }}
                />
              </g>
            )
          })}
        </svg>

      </div>

      <Legend goal={goal} />
    </figure>
  )
}

/**
 * The hovered day, or today when nothing is hovered. A fixed row rather than a
 * floating tooltip: the rail is 22rem wide, so a box big enough to hold four
 * numbers covers the columns it is describing.
 */
function Readout({ point, live }: { point?: DayPoint; live: boolean }) {
  if (!point) return null
  return (
    <div
      className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5"
      style={{ opacity: live ? 1 : 0.75, transition: 'opacity .15s' }}
    >
      <span className="hud-label">{point.label}</span>
      <span className="hud-num text-[0.9375rem] font-semibold text-[var(--hud-ink)]">
        {point.calories.toLocaleString()}
        <span className="ml-0.5 text-[0.625rem] font-normal text-[var(--hud-faint)]">kcal</span>
      </span>
      {MACRO_KEYS.map((k) => (
        <span key={k} className="flex items-center gap-1">
          <span
            aria-hidden
            className="h-[2px] w-2.5 shrink-0 rounded-full"
            style={{ background: MACRO[k] }}
          />
          <span className="hud-num text-[0.6875rem] font-semibold text-[var(--hud-ink)]">
            {GRAMS[k](point)}g
          </span>
        </span>
      ))}
      <span className="hud-num text-[0.6875rem] text-[var(--hud-faint)]">
        {point.fibre}g fibre
      </span>
    </div>
  )
}

function Legend({ goal }: { goal: number }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      {MACRO_KEYS.map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-[2px]"
            style={{ background: MACRO[k] }}
          />
          <span className="hud-label">{LABEL[k]}</span>
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-[1px] w-3 shrink-0"
          style={{ background: 'var(--hud-cyan)' }}
        />
        <span className="hud-label">goal {goal.toLocaleString()}</span>
      </span>
    </div>
  )
}

/**
 * A ratio against a limit. The unfilled track is a lighter step of the fill's
 * own ramp, so the state reads across the whole bar rather than only the
 * painted part.
 */
export function Meter({
  label,
  value,
  goal,
  unit,
  colour,
}: {
  label: string
  value: number
  goal: number
  unit: string
  colour: string
}) {
  const pct = goal > 0 ? (value / goal) * 100 : 0
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="hud-label truncate">{label}</span>
        <span className="hud-num text-[0.6875rem] text-[var(--hud-faint)]">
          {Math.round(value)}
          <span className="opacity-60">/{goal}</span> {unit}
        </span>
      </div>
      <div
        className="mt-1 h-[5px] overflow-hidden rounded-full"
        style={{ background: `color-mix(in oklab, ${colour} 22%, transparent)` }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(0, Math.min(100, pct))}%`,
            background: colour,
            transition: 'width .9s cubic-bezier(.22,1,.36,1)',
          }}
        />
      </div>
    </div>
  )
}

/**
 * The table twin. Every number in the chart is here without hovering, which is
 * what keeps the tooltip an enhancement rather than the only way to read a value.
 */
export function DataTable({ points, name }: { points: DayPoint[]; name: string }) {
  return (
    <table className="hud-num w-full border-collapse text-[0.6875rem]">
      <caption className="hud-label pb-1.5 text-left">{name} · per day</caption>
      <thead>
        <tr className="text-[var(--hud-faint)]">
          {['Day', 'kcal', 'P', 'C', 'F', 'Fib'].map((h, i) => (
            <th
              key={h}
              scope="col"
              className={cx('py-1 font-medium', i === 0 ? 'text-left' : 'text-right')}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr
            key={p.date}
            className="border-t border-[var(--hud-line-soft)]"
            style={p.today ? { color: 'var(--hud-ink)' } : { color: 'var(--hud-soft)' }}
          >
            <th scope="row" className="py-1 text-left font-medium">
              {p.label}
            </th>
            <td className="py-1 text-right tabular-nums">{p.calories.toLocaleString()}</td>
            <td className="py-1 text-right tabular-nums">{p.protein}</td>
            <td className="py-1 text-right tabular-nums">{p.carbs}</td>
            <td className="py-1 text-right tabular-nums">{p.fat}</td>
            <td className="py-1 text-right tabular-nums">{p.fibre}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
