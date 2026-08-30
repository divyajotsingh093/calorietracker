import { useEffect, useRef, useState } from 'react'
import { cx } from '@/components/ui'

export type ReactorState = 'idle' | 'listening' | 'thinking' | 'speaking'

const RING_COLOUR: Record<ReactorState, string> = {
  idle: 'var(--hud-cyan)',
  listening: 'var(--hud-lime)',
  thinking: 'var(--hud-violet)',
  speaking: 'var(--hud-cyan)',
}

/**
 * The reactor: three counter-rotating rings around a lit core. Speed and
 * colour are the whole status display — you can tell across a room whether it
 * is waiting, hearing you, working, or talking.
 */
export function Reactor({
  state,
  size = 132,
  onClick,
  label,
}: {
  state: ReactorState
  size?: number
  onClick?: () => void
  label?: string
}) {
  const hue = RING_COLOUR[state]
  const busy = state === 'thinking'
  const speeds = busy ? [3.4, 5, 7.4] : state === 'listening' ? [8, 11, 15] : [22, 30, 40]
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      {...(onClick ? { onClick, type: 'button' as const, 'aria-label': label } : {})}
      className={cx(
        'relative grid shrink-0 place-items-center',
        onClick && 'cursor-pointer',
      )}
      style={{ width: size, height: size }}
    >
      {/* expanding pulses, only while something is happening */}
      {state !== 'idle' &&
        [0, 1].map((i) => (
          <span
            key={i}
            aria-hidden
            className="absolute inset-2 rounded-full"
            style={{
              border: `1px solid ${hue}`,
              animation: `hud-pulse-ring 2.4s ease-out ${i * 1.2}s infinite`,
            }}
          />
        ))}

      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="absolute rounded-full"
          style={{
            inset: `${i * 9}%`,
            border: '1px solid',
            borderColor:
              i === 1
                ? `transparent ${hue} transparent ${hue}`
                : `${hue} transparent ${hue} transparent`,
            opacity: 0.28 + i * 0.16,
            animation: `${i === 1 ? 'hud-spin-back' : 'hud-spin'} ${speeds[i]}s linear infinite`,
          }}
        />
      ))}

      {/* dashed inner bezel */}
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          inset: '30%',
          border: `1px dashed ${hue}`,
          opacity: 0.3,
          animation: `hud-spin ${busy ? 9 : 46}s linear infinite`,
        }}
      />

      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          inset: '36%',
          background: `radial-gradient(circle at 38% 32%, ${hue}, transparent 68%)`,
          filter: 'blur(1px)',
          animation: `hud-breathe ${busy ? 1.1 : 3.6}s ease-in-out infinite`,
        }}
      />
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          inset: '45%',
          background: hue,
          boxShadow: `0 0 22px 5px ${hue}`,
        }}
      />
    </Tag>
  )
}

/** Level meter for the microphone — decorative bars, honest about it. */
export function Meter({ active, bars = 13 }: { active: boolean; bars?: number }) {
  return (
    <div aria-hidden className="flex h-6 items-center gap-[3px]">
      {Array.from({ length: bars }, (_, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full"
          style={{
            height: '100%',
            transformOrigin: 'center',
            background: active ? 'var(--hud-lime)' : 'var(--hud-line)',
            opacity: active ? 0.9 : 0.4,
            transform: active ? undefined : 'scaleY(0.2)',
            animation: active
              ? `hud-bar ${0.62 + ((i * 7) % 5) * 0.13}s ease-in-out ${i * 0.055}s infinite`
              : undefined,
          }}
        />
      ))}
    </div>
  )
}

/** Three dots that hop while the model is composing. */
export function Thinking() {
  return (
    <span aria-hidden className="inline-flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full"
          style={{
            background: 'var(--hud-cyan)',
            animation: `hud-type 1.05s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </span>
  )
}

/** A thin progress rail under a readout. */
export function Rail({ pct, tone = 'cyan' }: { pct: number; tone?: string }) {
  return (
    <div
      className="mt-2 h-[3px] overflow-hidden rounded-full"
      style={{ background: 'var(--hud-line-soft)' }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: `linear-gradient(90deg, var(--hud-${tone}), color-mix(in oklab, var(--hud-${tone}) 40%, transparent))`,
          boxShadow: `0 0 10px -2px var(--hud-${tone})`,
          transition: 'width 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  )
}

/**
 * Reveals text a few characters at a time. Purely presentational: the whole
 * reply is already in the DOM for a screen reader, only the visible slice
 * grows. Anyone who asked for reduced motion gets the text at once.
 */
export function Typed({ text, on }: { text: string; on: boolean }) {
  // The decision not to animate is knowable at first render, so it is made here
  // rather than in an effect that would render the text twice.
  const animate =
    on && !(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [n, setN] = useState(animate ? 0 : text.length)
  const raf = useRef(0)

  useEffect(() => {
    if (!animate) return
    let i = 0
    let last = performance.now()
    const step = (now: number) => {
      // ~90 characters a second, independent of frame rate
      const advance = Math.max(1, Math.round(((now - last) / 1000) * 90))
      last = now
      i = Math.min(text.length, i + advance)
      setN(i)
      if (i < text.length) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [text, animate])

  // If the reveal is cut short — a second question sent while this one is still
  // typing — the whole reply shows rather than freezing half-written.
  const shown = animate ? n : text.length
  const done = shown >= text.length
  return (
    <span>
      <span aria-hidden>{text.slice(0, shown)}</span>
      <span className="sr-only">{text}</span>
      {!done && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[1em] w-[0.5ch] translate-y-[0.1em] bg-[var(--hud-cyan)]"
          style={{ animation: 'hud-blink 1s steps(1) infinite' }}
        />
      )}
    </span>
  )
}
