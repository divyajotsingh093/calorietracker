import { useEffect, useRef, useState } from 'react'
import { cx, type as t } from '@/components/ui'

/** Counts a number up on mount and whenever it changes. */
function useCountUp(value: number, ms = 900) {
  const [reduced] = useState(
    () => typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    if (reduced) return
    const start = performance.now()
    const a = from.current
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(a + (value - a) * eased)
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms, reduced])
  return reduced ? value : shown
}

/**
 * Calorie progress donut. The arc draws itself in on mount, and the readout
 * counts up with it. Over-goal swaps to the warning hue rather than just
 * overflowing, so the state is legible without reading the number.
 */
export function CalorieRing({
  value,
  goal,
  size = 180,
  stroke = 16,
  label = 'kcal eaten',
}: {
  value: number
  goal: number
  size?: number
  stroke?: number
  label?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const shownValue = useCountUp(value)

  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const ratio = goal > 0 ? value / goal : 0
  const dash = (armed ? Math.min(1, ratio) : 0) * circumference
  const over = value > goal
  const remaining = Math.round(goal - value)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <defs>
          <linearGradient id="ringOk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
          <linearGradient id="ringOver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--warn)" />
            <stop offset="100%" stopColor="var(--danger)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--ring-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          opacity={value > 0 ? 1 : 0}
          stroke={over ? 'url(#ringOver)' : 'url(#ringOk)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{
            transition: 'stroke-dasharray 1.1s var(--ease-out), opacity 0.3s ease',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cx('text-faint', t.micro)}>{label}</span>
        <span
          className="font-display text-[2.25rem] font-semibold leading-none tabular-nums"
          style={{ fontVariationSettings: "'SOFT' 30, 'WONK' 0" }}
        >
          {Math.round(shownValue)}
        </span>
        <span className={cx('mt-1 tabular-nums', over ? 'text-warn' : 'text-faint', t.small)}>
          {over ? `${Math.abs(remaining)} over` : `${remaining} left`}
        </span>
      </div>
    </div>
  )
}

export function MacroBar({
  label,
  value,
  goal,
  tone,
  unit = 'g',
}: {
  label: string
  value: number
  goal: number
  tone: 'protein' | 'carbs' | 'fat' | 'fibre'
  unit?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  const colour = `var(--data-${tone})`

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className={cx('flex items-center gap-1.5 text-faint', t.micro)}>
          <i className="size-1.5 rounded-full" style={{ background: colour }} />
          {label}
        </span>
        <span className={cx('tabular-nums text-soft', t.small)}>
          {Math.round(value)}
          <span className="text-faint">
            /{goal}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--ring-track)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${armed ? pct : 0}%`,
            background: `linear-gradient(90deg, color-mix(in oklab, ${colour} 72%, transparent), ${colour})`,
            transition: 'width 0.9s var(--ease-out)',
          }}
        />
      </div>
    </div>
  )
}

/** Thin three-segment bar showing where a day's calories come from. */
export function SplitBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein + carbs + fat
  if (total <= 0) {
    return <div className="h-1.5 rounded-full" style={{ background: 'var(--ring-track)' }} />
  }
  const seg = (v: number, tone: string) => ({
    width: `${(v / total) * 100}%`,
    background: `var(--data-${tone})`,
    transition: 'width 0.7s var(--ease-out)',
  })
  return (
    <div
      className="flex h-1.5 overflow-hidden rounded-full"
      style={{ background: 'var(--ring-track)' }}
      title={`protein ${Math.round((protein / total) * 100)}% · carbs ${Math.round((carbs / total) * 100)}% · fat ${Math.round((fat / total) * 100)}%`}
    >
      <div style={seg(protein, 'protein')} />
      <div style={seg(carbs, 'carbs')} />
      <div style={seg(fat, 'fat')} />
    </div>
  )
}
