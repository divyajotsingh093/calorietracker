import { useEffect, useState } from 'react'
import { cx } from '@/components/ui'

/** Animated progress donut. */
export function CalorieRing({
  value,
  goal,
  size = 190,
  stroke = 16,
  label = 'kcal eaten',
}: {
  value: number
  goal: number
  size?: number
  stroke?: number
  label?: string
}) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value))
    return () => cancelAnimationFrame(id)
  }, [value])

  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const pct = goal > 0 ? Math.min(1.4, shown / goal) : 0
  const dash = Math.min(1, pct) * circumference
  const over = value > goal
  const remaining = Math.round(goal - value)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.88 0.19 128)" />
            <stop offset="55%" stopColor="oklch(0.84 0.14 168)" />
            <stop offset="100%" stopColor="oklch(0.8 0.13 210)" />
          </linearGradient>
          <linearGradient id="ringOver" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.8 0.17 40)" />
            <stop offset="100%" stopColor="oklch(0.7 0.19 5)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          opacity={value > 0 ? 1 : 0}
          stroke={over ? 'url(#ringOver)' : 'url(#ringGrad)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-[stroke-dasharray] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[13px] uppercase tracking-[0.14em] text-white/40">
          {label}
        </span>
        <span className="font-display text-4xl font-bold tabular-nums leading-tight">
          {Math.round(value)}
        </span>
        <span
          className={cx(
            'text-[13px] tabular-nums',
            over ? 'text-orange-300' : 'text-white/45',
          )}
        >
          {over ? `${Math.abs(remaining)} over` : `${remaining} left`} · goal {goal}
        </span>
      </div>
    </div>
  )
}

export function MacroBar({
  label,
  value,
  goal,
  color,
  unit = 'g',
}: {
  label: string
  value: number
  goal: number
  color: string
  unit?: string
}) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/45">
          {label}
        </span>
        <span className="text-[13px] tabular-nums text-white/70">
          {Math.round(value)}
          <span className="text-white/30">
            /{goal}
            {unit}
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className={cx('h-full rounded-full transition-[width] duration-700 ease-out', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Thin three-segment bar showing where a day's calories come from. */
export function SplitBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const total = protein + carbs + fat
  if (total <= 0) return <div className="h-1.5 rounded-full bg-white/8" />
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-white/8">
      <div className="bg-sky-300/80" style={{ width: `${(protein / total) * 100}%` }} />
      <div className="bg-lime-300/80" style={{ width: `${(carbs / total) * 100}%` }} />
      <div className="bg-orange-300/80" style={{ width: `${(fat / total) * 100}%` }} />
    </div>
  )
}
