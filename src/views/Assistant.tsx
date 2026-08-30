import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Meter, Rail, Reactor, Thinking, Typed, type ReactorState } from '@/components/hud'
import {
  IconBolt,
  IconMic,
  IconMicOff,
  IconSend,
  IconSettings,
  IconWave,
  IconWaveOff,
  IconX,
} from '@/components/icons'
import { cx } from '@/components/ui'
import {
  SYSTEM_PROMPT,
  answerLocally,
  askAnthropic,
  askOpenRouter,
  assistantProvider,
  buildContext,
  buildLibrary,
  type ActionRecord,
  type ToolCall,
  type Turn,
  type WireMessage,
} from '@/lib/assistant'
import { todayISO } from '@/lib/date'
import { dayTotals } from '@/lib/nutrition'
import { dietClash } from '@/lib/profiles'
import { useListener, useVoice } from '@/lib/speech'
import { useStore, uid } from '@/lib/store'
import type { MealSlot, PlanEntry, Profile } from '@/types'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

const PROMPTS = [
  'What is left in my budget today?',
  'Suggest a high-protein dinner under 550 kcal',
  'Am I short on fibre this week?',
  'Log a flat white and a banana for me',
  'Swap tomorrow’s lunch for something Italian',
  'What should I prep tonight for tomorrow?',
]

export function Assistant({ onOpenSettings }: { onOpenSettings: () => void }) {
  const store = useStore()
  const { state, recipeMap, days, scoped, activeProfile } = store

  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const voice = useVoice()
  const provider = assistantProvider(state.settings)
  const today = todayISO()

  /* ─────────── tools, run against the real store ─────────── */

  const findProfiles = useCallback(
    (who: unknown): Profile[] => {
      const name = String(who ?? '').toLowerCase()
      if (!name || name === 'both' || name === 'everyone' || name === 'us') return state.profiles
      const hit = state.profiles.filter((p) => name.includes(p.name.toLowerCase()))
      return hit.length ? hit : activeProfile ? [activeProfile] : state.profiles
    },
    [state.profiles, activeProfile],
  )

  const runTool = useCallback(
    (call: ToolCall): ActionRecord => {
      const a = call.input
      const date = typeof a.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : today
      const slot = (SLOTS.includes(a.slot as MealSlot) ? a.slot : 'snack') as MealSlot
      const people = findProfiles(a.person)
      const fail = (detail: string): ActionRecord => ({ name: call.name, detail, ok: false })

      switch (call.name) {
        case 'log_meal': {
          const label = String(a.label ?? 'Meal')
          const kcal = Number(a.calories) || 0
          for (const p of people) {
            store.addPhoto({
              profileId: p.id,
              date,
              slot,
              label,
              calories: Math.round(kcal),
              protein: Math.round((Number(a.protein) || 0) * 10) / 10,
              carbs: Math.round((Number(a.carbs) || 0) * 10) / 10,
              fat: Math.round((Number(a.fat) || 0) * 10) / 10,
              fibre: Math.round((Number(a.fibre) || 0) * 10) / 10,
              source: 'ai',
              note: 'Logged by NOVA',
            })
          }
          return {
            name: call.name,
            detail: `Logged ${label} — ${Math.round(kcal)} kcal for ${people.map((p) => p.name).join(' & ')}`,
            ok: true,
          }
        }

        case 'plan_meal': {
          const recipe = recipeMap.get(String(a.recipe_id ?? ''))
          if (!recipe) return fail(`No dish with id ${String(a.recipe_id)}`)
          // The model is told Ruchi's diet, but the store is the one that has
          // to be right: refuse the plan rather than trusting the reply.
          const clash = people.map((p) => dietClash(recipe, p)).find(Boolean)
          if (clash) return fail(`${clash} ${recipe.name} was not planned.`)
          store.addPlanEntry(
            date,
            slot,
            recipe.id,
            people.map((p) => p.id),
            Number(a.servings) || 1,
          )
          return {
            name: call.name,
            detail: `Planned ${recipe.name} for ${slot} on ${date} — ${people.map((p) => p.name).join(' & ')}`,
            ok: true,
          }
        }

        case 'remove_meal': {
          const recipe = recipeMap.get(String(a.recipe_id ?? ''))
          if (!recipe) return fail(`No dish with id ${String(a.recipe_id)}`)
          store.removeMeal(
            date,
            slot,
            recipe.id,
            people.map((p) => p.id),
          )
          return {
            name: call.name,
            detail: `Removed ${recipe.name} from ${slot} on ${date}`,
            ok: true,
          }
        }

        case 'mark_eaten': {
          const want = a.eaten === false ? false : true
          const ids = new Set(people.map((p) => p.id))
          const hits = state.plan.filter(
            (e: PlanEntry) => e.date === date && e.slot === slot && ids.has(e.profileId),
          )
          if (!hits.length) return fail(`Nothing is planned for ${slot} on ${date}`)
          for (const e of hits) store.updatePlanEntry(e.id, { eaten: want })
          return {
            name: call.name,
            detail: `${want ? 'Ticked off' : 'Un-ticked'} ${slot} on ${date} for ${people.map((p) => p.name).join(' & ')}`,
            ok: true,
          }
        }

        case 'add_to_shopping_list': {
          const item = String(a.item ?? '').trim()
          if (!item) return fail('No item given')
          const week = Number(a.week) === 1 ? 1 : 0
          store.addExtra(week, item)
          return {
            name: call.name,
            detail: `Added ${item} to ${week === 0 ? 'this' : 'next'} week's list`,
            ok: true,
          }
        }

        default:
          return fail(`Unknown tool ${call.name}`)
      }
    },
    [findProfiles, recipeMap, state.plan, store, today],
  )

  /* ─────────── the turn ─────────── */

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim()
      if (!question || busy) return
      setDraft('')
      const mine: Turn = { id: uid(), role: 'user', text: question }
      setTurns((t) => [...t, mine])

      if (!provider) {
        const text = answerLocally(question, state, recipeMap, scoped)
        setTurns((t) => [...t, { id: uid(), role: 'assistant', text, local: true }])
        voice.speak(text)
        return
      }

      setBusy(true)
      const system = [
        SYSTEM_PROMPT,
        '',
        '# Current state',
        buildContext(state, recipeMap, days),
        '',
        '# Dish library — id | name | cuisine | slots | macros | portion | diet',
        buildLibrary(state.recipes),
      ].join('\n')

      const history: WireMessage[] = turns
        .filter((t) => !t.error)
        .slice(-8)
        .map((t) => ({ role: t.role, content: t.text }))
      const wire: WireMessage[] = [...history, { role: 'user', content: question }]

      const ask = (msgs: WireMessage[]) =>
        provider === 'anthropic'
          ? askAnthropic(msgs, system, state.settings.apiKey.trim())
          : askOpenRouter(
              msgs,
              system,
              state.settings.openrouterKey.trim(),
              state.settings.openrouterModel.trim(),
            )

      try {
        const done: ActionRecord[] = []
        let reply = await ask(wire)

        // One round of tools is enough for everything this assistant can do;
        // a second pass lets it report on what actually happened.
        if (reply.calls.length) {
          const results = reply.calls.map((c) => ({ call: c, record: runTool(c) }))
          done.push(...results.map((r) => r.record))

          const asAssistant =
            provider === 'anthropic'
              ? {
                  role: 'assistant' as const,
                  content: [
                    ...(reply.text ? [{ type: 'text', text: reply.text }] : []),
                    ...reply.calls.map((c) => ({
                      type: 'tool_use',
                      id: c.id,
                      name: c.name,
                      input: c.input,
                    })),
                  ],
                }
              : {
                  role: 'assistant' as const,
                  content: reply.text || '',
                }
          const asResult =
            provider === 'anthropic'
              ? {
                  role: 'user' as const,
                  content: results.map((r) => ({
                    type: 'tool_result',
                    tool_use_id: r.call.id,
                    content: r.record.detail,
                    is_error: !r.record.ok,
                  })),
                }
              : {
                  role: 'user' as const,
                  content: `Result of what you asked for: ${results
                    .map((r) => `${r.record.ok ? 'done' : 'failed'} — ${r.record.detail}`)
                    .join('; ')}. Tell me in one line, and do not call the tool again.`,
                }

          reply = await ask([...wire, asAssistant, asResult])
        }

        const text = reply.text || 'Done.'
        setTurns((t) => [
          ...t,
          { id: uid(), role: 'assistant', text, actions: done.length ? done : undefined },
        ])
        voice.speak(text)
      } catch (err) {
        setTurns((t) => [
          ...t,
          {
            id: uid(),
            role: 'assistant',
            text: err instanceof Error ? err.message : 'That request did not go through.',
            error: true,
          },
        ])
      } finally {
        setBusy(false)
      }
    },
    [busy, days, provider, recipeMap, runTool, scoped, state, turns, voice],
  )

  const listener = useListener((text) => void send(text))

  useEffect(() => {
    if (!turns.length) return
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [turns, busy])

  const reactor: ReactorState = busy
    ? 'thinking'
    : listener.listening
      ? 'listening'
      : voice.speaking
        ? 'speaking'
        : 'idle'

  const status = busy
    ? 'Working'
    : listener.listening
      ? 'Listening'
      : voice.speaking
        ? 'Speaking'
        : provider
          ? 'Standing by'
          : 'Local mode'

  /* ─────────── live telemetry ─────────── */

  const telemetry = useMemo(
    () =>
      scoped.map((p) => {
        const eaten = dayTotals(today, p.id, state.plan, state.photos, recipeMap, 'eaten')
        const planned = dayTotals(today, p.id, state.plan, state.photos, recipeMap, 'planned')
        return {
          p,
          left: Math.round(p.calorieGoal - eaten.calories),
          kcalPct: (eaten.calories / Math.max(1, p.calorieGoal)) * 100,
          protein: Math.round(eaten.protein),
          proteinPct: (eaten.protein / Math.max(1, p.proteinGoal)) * 100,
          fibre: Math.round(eaten.fibre),
          fibrePct: (eaten.fibre / Math.max(1, p.fibreGoal)) * 100,
          planned: Math.round(planned.calories),
        }
      }),
    [scoped, state.plan, state.photos, recipeMap, today],
  )

  return (
    <div className="animate-rise space-y-4">
      <div className="hud flex h-[calc(100svh-11.5rem)] flex-col lg:h-auto lg:min-h-[42rem]">
        {/* ── masthead ── */}
        <header className="flex items-center gap-5 border-b border-[var(--hud-line-soft)] px-4 py-4 sm:px-6">
          <Reactor state={reactor} size={58} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2.5">
              <h1
                className="hud-num text-[1.25rem] font-semibold tracking-[0.24em] text-[var(--hud-ink)]"
                style={{ textShadow: '0 0 22px var(--hud-cyan)' }}
              >
                NOVA
              </h1>
              <span className="hud-label hidden sm:inline">nutrition intelligence</span>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <span
                className="size-1.5 rounded-full"
                style={{
                  background: busy ? 'var(--hud-violet)' : 'var(--hud-lime)',
                  boxShadow: `0 0 8px ${busy ? 'var(--hud-violet)' : 'var(--hud-lime)'}`,
                  animation: 'hud-blink 1.8s steps(1) infinite',
                }}
              />
              <span className="hud-label">
                {status}
                {provider ? ` · ${provider}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {voice.supported && (
              <HudButton
                label={voice.enabled ? 'Mute replies' : 'Read replies aloud'}
                active={voice.enabled}
                onClick={() => voice.setEnabled(!voice.enabled)}
              >
                {voice.enabled ? (
                  <IconWave width={17} height={17} />
                ) : (
                  <IconWaveOff width={17} height={17} />
                )}
              </HudButton>
            )}
            {turns.length > 0 && (
              <HudButton label="Clear conversation" onClick={() => setTurns([])}>
                <IconX width={17} height={17} />
              </HudButton>
            )}
            <HudButton label="Assistant settings" onClick={onOpenSettings}>
              <IconSettings width={17} height={17} />
            </HudButton>
          </div>
        </header>

        {/* ── telemetry ── */}
        <div className="grid grid-cols-2 gap-2.5 px-4 py-3 sm:px-6">
          {telemetry.map((t) => (
            <div key={t.p.id} className="hud-frame px-3 py-2.5 sm:px-3.5 sm:py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="hud-label truncate">
                  {t.p.emoji} {t.p.name}
                </span>
                <span className="hud-num hidden text-[0.625rem] text-[var(--hud-faint)] sm:inline">
                  {t.planned} kcal planned
                </span>
              </div>
              {/* Fibre is the third priority, so it is the one that goes when
                  the column is only half a phone wide. */}
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Cell
                  value={t.left}
                  unit="left"
                  tone={t.left < 0 ? 'amber' : 'cyan'}
                  pct={t.kcalPct}
                />
                <Cell
                  value={t.protein}
                  unit={`/${t.p.proteinGoal} P`}
                  tone="violet"
                  pct={t.proteinPct}
                />
                <div className="hidden sm:block">
                  <Cell
                    value={t.fibre}
                    unit={`/${t.p.fibreGoal} fib`}
                    tone="lime"
                    pct={t.fibrePct}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── transcript ── */}
        <div
          ref={scroller}
          // min-h-0: a flex item defaults to min-height:auto, so without this the
          // standby panel refuses to shrink and pushes the composer off-screen
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-2 sm:px-6"
          aria-live="polite"
        >
          {turns.length === 0 ? (
            <Standby provider={Boolean(provider)} onPick={(p) => void send(p)} />
          ) : (
            <div className="space-y-3 py-1">
              {turns.map((turn, i) => (
                <Bubble key={turn.id} turn={turn} fresh={i === turns.length - 1} />
              ))}
              {busy && (
                <div className="hud-nova inline-flex items-center gap-2.5 rounded-2xl px-4 py-2.5">
                  <Thinking />
                  <span className="hud-label">reading the plan</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── composer ── */}
        <div className="border-t border-[var(--hud-line-soft)] px-4 py-3.5 sm:px-6">
          {listener.listening && (
            <div className="mb-2.5 flex items-center gap-3">
              <Meter active />
              <span className="hud-num flex-1 truncate text-[0.8125rem] text-[var(--hud-soft)]">
                {listener.heard || 'go ahead…'}
              </span>
            </div>
          )}
          {listener.error && (
            <p className="hud-num mb-2 text-[0.75rem] text-[var(--hud-amber)]">{listener.error}</p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault()
              void send(draft)
            }}
            className="flex items-center gap-2"
          >
            <div className="hud-frame flex flex-1 items-center gap-2 px-3 py-1">
              <IconBolt width={15} height={15} className="shrink-0 text-[var(--hud-cyan)]" />
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask NOVA…"
                aria-label="Message NOVA"
                className="hud-num min-w-0 flex-1 border-0 bg-transparent py-2 text-[0.875rem] text-[var(--hud-ink)] outline-none placeholder:text-[var(--hud-faint)]"
              />
            </div>

            {listener.supported && (
              <HudButton
                label={listener.listening ? 'Stop listening' : 'Speak to NOVA'}
                active={listener.listening}
                onClick={() => (listener.listening ? listener.stop() : listener.start())}
                big
              >
                {listener.listening ? (
                  <IconMicOff width={19} height={19} />
                ) : (
                  <IconMic width={19} height={19} />
                )}
              </HudButton>
            )}

            <button
              type="submit"
              disabled={!draft.trim() || busy}
              aria-label="Send"
              className="press grid size-11 shrink-0 cursor-pointer place-items-center rounded-xl transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
              style={{
                background: 'linear-gradient(135deg, var(--hud-cyan), var(--hud-violet))',
                color: 'oklch(0.16 0.03 268)',
                boxShadow: '0 0 22px -8px var(--hud-cyan)',
              }}
            >
              <IconSend width={19} height={19} />
            </button>
          </form>

          <p className="hud-label mt-2.5 leading-relaxed">
            {provider
              ? 'NOVA can log meals, plan dishes and edit your shopping list — it says what it changed.'
              : 'No model connected — answering from your own data. Add a key in Settings for the rest.'}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── pieces ───────────────────────── */

function Cell({
  value,
  unit,
  tone,
  pct,
}: {
  value: number
  unit: string
  tone: 'cyan' | 'violet' | 'lime' | 'amber'
  pct: number
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline gap-x-1">
        <span
          className="hud-num text-[1.0625rem] leading-none font-semibold"
          style={{ color: `var(--hud-${tone})` }}
        >
          {value}
        </span>
        <span className="hud-num text-[0.625rem] text-[var(--hud-faint)]">{unit}</span>
      </div>
      <Rail pct={pct} tone={tone} />
    </div>
  )
}

function HudButton({
  children,
  label,
  onClick,
  active,
  big,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
  big?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cx(
        'press grid shrink-0 cursor-pointer place-items-center rounded-xl border transition-colors',
        big ? 'size-11' : 'size-9',
      )}
      style={{
        borderColor: active ? 'var(--hud-lime)' : 'var(--hud-line-soft)',
        background: active ? 'oklch(0.88 0.17 150 / 0.14)' : 'var(--hud-panel)',
        color: active ? 'var(--hud-lime)' : 'var(--hud-soft)',
        boxShadow: active ? '0 0 20px -8px var(--hud-lime)' : undefined,
      }}
    >
      {children}
    </button>
  )
}

function Standby({ provider, onPick }: { provider: boolean; onPick: (p: string) => void }) {
  return (
    <div className="flex flex-col items-center py-4 text-center sm:py-10">
      <div className="origin-bottom scale-[0.7] sm:scale-100">
        <Reactor state="idle" size={150} />
      </div>
      <p className="hud-num mt-3 max-w-md text-[0.875rem] leading-relaxed text-[var(--hud-soft)] sm:mt-5 sm:text-[0.9375rem]">
        {provider
          ? 'I have today’s numbers, the fortnight’s plan and every dish in the library. Ask, or press the microphone.'
          : 'Running on your own data. I can tell you what is planned, what has been eaten and what is left.'}
      </p>
      <div className="mt-4 flex max-w-2xl flex-wrap justify-center gap-2 sm:mt-5">
        {PROMPTS.map((p, i) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            className="press hud-frame hud-num cursor-pointer px-3 py-2 text-[0.75rem] text-[var(--hud-soft)] transition-colors hover:text-[var(--hud-ink)]"
            style={{ animation: `rise 0.5s var(--ease-out) ${i * 60}ms both` }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

function Bubble({ turn, fresh }: { turn: Turn; fresh: boolean }) {
  const mine = turn.role === 'user'
  return (
    <div className={cx('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cx(
          'animate-pop max-w-[88%] rounded-2xl px-4 py-3 sm:max-w-[74%]',
          mine ? 'hud-said' : 'hud-nova',
        )}
        style={turn.error ? { borderColor: 'var(--hud-amber)' } : undefined}
      >
        {!mine && (
          <div className="hud-label mb-1.5 flex items-center gap-1.5">
            <span style={{ color: turn.error ? 'var(--hud-amber)' : 'var(--hud-cyan)' }}>
              {turn.error ? 'fault' : 'nova'}
            </span>
            {turn.local && <span>· local</span>}
          </div>
        )}
        <p
          className={cx(
            'hud-num text-[0.875rem] leading-relaxed whitespace-pre-wrap',
            turn.error ? 'text-[var(--hud-amber)]' : 'text-[var(--hud-ink)]',
          )}
        >
          {mine ? turn.text : <Typed text={turn.text} on={fresh} />}
        </p>

        {turn.actions?.length ? (
          <ul className="mt-3 space-y-1.5 border-t border-[var(--hud-line-soft)] pt-2.5">
            {turn.actions.map((a, i) => (
              <li key={i} className="hud-num flex gap-2 text-[0.75rem]">
                <span
                  style={{ color: a.ok ? 'var(--hud-lime)' : 'var(--hud-amber)' }}
                  aria-hidden
                >
                  {a.ok ? '▸' : '✕'}
                </span>
                <span className="text-[var(--hud-soft)]">{a.detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
