import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DataTable, MACRO, MacroColumns, Meter as Bar, niceMax } from '@/components/charts'
import { Meter, Reactor, Thinking, Typed, type ReactorState } from '@/components/hud'
import {
  IconBolt,
  IconMic,
  IconMicOff,
  IconSend,
  IconPlus,
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
  DEFAULT_CHAT_MODEL,
  assistantProvider,
  buildContext,
  buildHabits,
  buildMemory,
  emptyReplyNote,
  resultMessages,
  buildLibrary,
  type ActionRecord,
  type ToolCall,
  type Turn,
  type WireMessage,
} from '@/lib/assistant'
import { todayISO } from '@/lib/date'
import { dayTotals } from '@/lib/nutrition'
import { averages, daySeries } from '@/lib/series'
import { dietClash } from '@/lib/profiles'
import { quota } from '@/lib/openrouter'
import { useServerKey } from '@/lib/serverKey'
import { useListener, useVoice } from '@/lib/speech'
import { ACCENTS, type Accent, type ThemeMode } from '@/lib/theme'
import { useStore } from '@/lib/store'
import type { MealSlot, Memory, PlanEntry, Profile } from '@/types'

const SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']
const TABS = ['today', 'plan', 'recipes', 'grocery', 'snap'] as const
type Tab = (typeof TABS)[number]
const MODES: string[] = ['light', 'dark', 'system']
const ACCENT_IDS: string[] = ACCENTS.map((a) => a.id)
const ISO = /^\d{4}-\d{2}-\d{2}$/

const PROMPTS = [
  'What is left in my budget today?',
  'Suggest a high-protein dinner under 550 kcal',
  'Am I short on fibre this week?',
  'Log a flat white and a banana for me',
  'Swap tomorrow’s lunch for something Italian',
  'What should I prep tonight for tomorrow?',
]

export interface AssistantProps {
  onOpenSettings: () => void
  /** NOVA can move the app between screens */
  onNavigate: (tab: 'today' | 'plan' | 'recipes' | 'grocery' | 'snap') => void
  theme: { setMode: (m: ThemeMode) => void; setAccent: (a: Accent) => void }
}

export function Assistant({ onOpenSettings, onNavigate, theme }: AssistantProps) {
  const store = useStore()
  const { state, recipeMap, days, scoped, activeProfile } = store

  // the conversation lives in the store, so switching tabs or reloading no
  // longer throws it away
  const turns = state.chat
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  // requests left on the key, read from the last response's headers
  const [left, setLeft] = useState<number | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const voice = useVoice()
  const server = useServerKey()
  const provider = assistantProvider(state.settings, server.configured)
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
      const date = typeof a.date === 'string' && ISO.test(a.date) ? a.date : today
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

        case 'set_goals': {
          const target = people[0]
          if (!target) return fail('No such person')
          const patch: Partial<Profile> = {}
          const map = [
            ['calories', 'calorieGoal'],
            ['protein', 'proteinGoal'],
            ['carbs', 'carbGoal'],
            ['fat', 'fatGoal'],
            ['fibre', 'fibreGoal'],
          ] as const
          const changed: string[] = []
          for (const [arg, key] of map) {
            const n = Number(a[arg])
            if (Number.isFinite(n) && n > 0) {
              patch[key] = Math.round(n)
              changed.push(`${arg} ${Math.round(n)}`)
            }
          }
          if (!changed.length) return fail('No goal values were given')
          store.updateProfile(target.id, patch)
          return {
            name: call.name,
            detail: `${target.name}: ${changed.join(', ')}`,
            ok: true,
          }
        }

        case 'set_view': {
          const name = String(a.person ?? '').toLowerCase()
          const one = state.profiles.find((p) => name.includes(p.name.toLowerCase()))
          store.setScope(one ? one.id : 'both')
          return {
            name: call.name,
            detail: `Showing ${one ? one.name : 'both plans'}`,
            ok: true,
          }
        }

        case 'open_tab': {
          const tab = String(a.tab ?? '')
          if (!TABS.includes(tab as Tab)) return fail(`No screen called ${tab}`)
          onNavigate(tab as Tab)
          return { name: call.name, detail: `Opened ${tab}`, ok: true }
        }

        case 'copy_day': {
          const from = String(a.from ?? '')
          const to = String(a.to ?? '')
          if (!ISO.test(from) || !ISO.test(to)) return fail('Dates must be yyyy-mm-dd')
          if (!state.plan.some((e) => e.date === from)) return fail(`Nothing is planned on ${from}`)
          store.copyDay(from, to)
          return { name: call.name, detail: `Copied ${from} onto ${to}`, ok: true }
        }

        case 'clear_day': {
          if (!ISO.test(date)) return fail('Date must be yyyy-mm-dd')
          if (!state.plan.some((e) => e.date === date)) return fail(`${date} is already empty`)
          store.clearDay(date)
          return { name: call.name, detail: `Cleared ${date}`, ok: true }
        }

        case 'copy_week': {
          const from = Number(a.from) === 1 ? 1 : 0
          const to = Number(a.to) === 1 ? 1 : 0
          if (from === to) return fail('Pick two different weeks')
          store.copyWeek(from, to)
          return {
            name: call.name,
            detail: `Copied week ${from + 1} onto week ${to + 1}`,
            ok: true,
          }
        }

        case 'set_appearance': {
          const changed: string[] = []
          const mode = String(a.mode ?? '')
          const accent = String(a.accent ?? '')
          if (MODES.includes(mode as ThemeMode)) {
            theme.setMode(mode as ThemeMode)
            changed.push(`${mode} mode`)
          }
          if (ACCENT_IDS.includes(accent as Accent)) {
            theme.setAccent(accent as Accent)
            changed.push(`${accent} accent`)
          }
          if (!changed.length) return fail('No recognised mode or accent')
          return { name: call.name, detail: `Switched to ${changed.join(' and ')}`, ok: true }
        }

        case 'remember': {
          const fact = String(a.fact ?? '').trim()
          if (!fact) return fail('Nothing to remember')
          const m = store.remember(fact, 'nova')
          if (!m) return fail('Nothing to remember')
          return { name: call.name, detail: `Remembered: ${m.text}`, ok: true }
        }

        case 'forget': {
          const needle = String(a.fact ?? '').trim().toLowerCase()
          const hit = state.memories.find(
            (m) => m.text.toLowerCase().includes(needle) || needle.includes(m.text.toLowerCase()),
          )
          if (!needle || !hit) return fail('Nothing matching that is remembered')
          store.forget(hit.id)
          return { name: call.name, detail: `Forgot: ${hit.text}`, ok: true }
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
    [findProfiles, onNavigate, recipeMap, state.memories, state.plan, state.profiles, store, theme, today],
  )

  /* ─────────── the turn ─────────── */

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim()
      if (!question || busy) return
      setDraft('')
      store.addTurn({ role: 'user', text: question })

      if (!provider) {
        const text = answerLocally(question, state, recipeMap, scoped)
        store.addTurn({ role: 'assistant', text, local: true })
        voice.speak(text)
        return
      }

      setBusy(true)
      const system = [
        SYSTEM_PROMPT,
        '',
        '# Current state',
        buildContext(state, recipeMap, days),
        buildMemory(state.memories),
        buildHabits(state, recipeMap, state.profiles),
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
              state.settings.openrouterChatModel.trim(),
            )

      try {
        const done: ActionRecord[] = []
        const convo: WireMessage[] = [...wire]
        let reply = await ask(convo)

        // Keep going while the model asks for tools, but not far. One round was
        // not enough — a model that plans a dish, sees it worked and then wants
        // to tick it off had its second call dropped. Four rounds was too many
        // for a different reason: a free OpenRouter key allows 50 requests a
        // day, and five per question is ten questions before the app stops
        // working. Two rounds covers every sequence these tools actually need.
        for (let round = 0; round < 2 && reply.calls.length; round++) {
          const results = reply.calls.map((c) => ({ call: c, record: runTool(c) }))
          done.push(...results.map((r) => r.record))
          convo.push(reply.echo as WireMessage, ...resultMessages(provider, results))
          reply = await ask(convo)
        }

        const text = reply.text || emptyReplyNote(reply, done)
        store.addTurn({
          role: 'assistant',
          text,
          actions: done.length ? done : undefined,
          error: !reply.text && !done.length,
        })
        voice.speak(text)
      } catch (err) {
        store.addTurn({
          role: 'assistant',
          text: err instanceof Error ? err.message : 'That request did not go through.',
          error: true,
        })
      } finally {
        setLeft(quota()?.remaining ?? null)
        setBusy(false)
      }
    },
    [busy, days, provider, recipeMap, runTool, scoped, state, store, turns, voice],
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

  const engine =
    provider === 'openrouter'
      ? state.settings.openrouterChatModel.trim() || DEFAULT_CHAT_MODEL
      : provider === 'anthropic'
        ? 'anthropic'
        : ''

  /* ─────────── signals ─────────── */

  const [pane, setPane] = useState<'console' | 'signals'>('console')

  // The visible week, per person: the stacked column reads a whole week at a
  // glance, which is the question the numbers alone never answered — is the
  // shortfall today, or every day?
  const signals = useMemo(() => {
    const rows = scoped.map((p) => {
      const points = daySeries(days.slice(0, 7), p, state.plan, state.photos, recipeMap)
      return { profile: p, points, avg: averages(points) }
    })
    // one ceiling across both people, so the two charts can be read against
    // each other rather than each flattering its own owner
    const peak = Math.max(
      ...rows.flatMap((r) => [r.profile.calorieGoal, ...r.points.map((p) => p.calories)]),
      1,
    )
    return { rows, max: niceMax(peak * 1.08) }
  }, [scoped, days, state.plan, state.photos, recipeMap])

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
              <span className="hud-label truncate">
                {status}
                {engine ? ` · ${engine}` : ''}
                {left != null ? ` · ${left} left today` : ''}
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
              <HudButton label="Clear conversation" onClick={store.clearChat}>
                <IconX width={17} height={17} />
              </HudButton>
            )}
            <HudButton label="Assistant settings" onClick={onOpenSettings}>
              <IconSettings width={17} height={17} />
            </HudButton>
          </div>
        </header>

        {/* ── pane switch: side by side on a desktop, one at a time on a phone ── */}
        <div className="flex gap-1.5 px-4 pt-3 sm:px-6 lg:hidden">
          {(['console', 'signals'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setPane(id)}
              aria-pressed={pane === id}
              className="press hud-label flex-1 cursor-pointer rounded-lg border py-2 transition-colors"
              style={{
                borderColor: pane === id ? 'var(--hud-cyan)' : 'var(--hud-line-soft)',
                background: pane === id ? 'oklch(0.84 0.14 200 / 0.12)' : 'transparent',
                color: pane === id ? 'var(--hud-cyan)' : 'var(--hud-faint)',
              }}
            >
              {id === 'console' ? 'Console' : 'Signals'}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]">
          {/* ── conversation ── */}
          <div
            className={cx(
              'flex min-h-0 flex-1 flex-col lg:flex',
              pane === 'signals' && 'hidden lg:flex',
            )}
          >
            <div
              ref={scroller}
              // min-h-0: a flex item defaults to min-height:auto, so without this
              // the standby panel refuses to shrink and pushes the composer off
              className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-2 sm:px-6"
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
              ? `NOVA runs the app — plan, log, goals, screens and theme. It says what it changed.${
                  provider === 'openrouter' && !state.settings.openrouterKey.trim()
                    ? ' Using this site’s own key.'
                    : ''
                }`
              : 'No model connected — answering from your own data. Add a key in Settings for the rest.'}
          </p>
            </div>
          </div>

          {/* ── signals ── */}
          <aside
            className={cx(
              'no-scrollbar min-h-0 space-y-4 overflow-y-auto px-4 py-3 sm:px-6 lg:block lg:border-l lg:border-[var(--hud-line-soft)] lg:px-4',
              pane === 'console' && 'hidden lg:block',
            )}
            aria-label="Nutrition signals"
          >
            {signals.rows.map(({ profile, points, avg }) => {
              const eaten = dayTotals(
                today,
                profile.id,
                state.plan,
                state.photos,
                recipeMap,
                'eaten',
              )
              return (
                <section key={profile.id} className="hud-frame px-3 py-3">
                  <div className="mb-2.5 flex items-baseline justify-between gap-2">
                    <span className="hud-label truncate">
                      {profile.emoji} {profile.name}
                    </span>
                    <span className="hud-num text-[0.625rem] text-[var(--hud-faint)]">
                      avg {avg.calories.toLocaleString()} kcal · {avg.protein} g P
                    </span>
                  </div>

                  <div className="mb-3 space-y-2">
                    <Bar
                      label="Eaten today"
                      value={eaten.calories}
                      goal={profile.calorieGoal}
                      unit="kcal"
                      colour={MACRO.protein}
                    />
                    <Bar
                      label="Protein"
                      value={eaten.protein}
                      goal={profile.proteinGoal}
                      unit="g"
                      colour={MACRO.carbs}
                    />
                    <Bar
                      label="Fibre"
                      value={eaten.fibre}
                      goal={profile.fibreGoal}
                      unit="g"
                      colour={MACRO.fat}
                    />
                  </div>

                  <MacroColumns
                    points={points}
                    goal={profile.calorieGoal}
                    name={profile.name}
                    max={signals.max}
                  />

                  <details className="mt-3 border-t border-[var(--hud-line-soft)] pt-2">
                    <summary className="hud-label cursor-pointer list-none">
                      Show the numbers
                    </summary>
                    <div className="mt-2">
                      <DataTable points={points} name={profile.name} />
                    </div>
                  </details>
                </section>
              )
            })}

            <Memories
              memories={state.memories}
              onAdd={(t) => store.remember(t, 'you')}
              onForget={store.forget}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

/* ───────────────────────── pieces ───────────────────────── */

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

/**
 * What NOVA has learned, in plain sentences you can delete.
 *
 * Memory that cannot be inspected is memory you cannot correct, and an
 * assistant acting on a belief you never got to see is worse than one that
 * forgets everything. Habits are derived from the plan each turn and are
 * deliberately absent here — there is nothing to edit, only the plan itself.
 */
function Memories({
  memories,
  onAdd,
  onForget,
}: {
  memories: Memory[]
  onAdd: (text: string) => void
  onForget: (id: string) => void
}) {
  const [draft, setDraft] = useState('')
  return (
    <section className="hud-frame px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="hud-label">What NOVA remembers</span>
        <span className="hud-num text-[0.625rem] text-[var(--hud-faint)]">
          {memories.length}
        </span>
      </div>

      {memories.length ? (
        <ul className="mb-2.5 space-y-1.5">
          {memories.map((m) => (
            <li key={m.id} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-[6px] size-1.5 shrink-0 rounded-full"
                style={{
                  background: m.source === 'you' ? 'var(--hud-cyan)' : 'var(--hud-violet)',
                }}
              />
              <span className="hud-num min-w-0 flex-1 text-[0.75rem] leading-snug text-[var(--hud-soft)]">
                {m.text}
              </span>
              <button
                type="button"
                onClick={() => onForget(m.id)}
                aria-label={`Forget: ${m.text}`}
                className="press shrink-0 cursor-pointer rounded p-0.5 text-[var(--hud-faint)] hover:text-[var(--hud-amber)]"
              >
                <IconX width={13} height={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="hud-num mb-2.5 text-[0.75rem] leading-snug text-[var(--hud-faint)]">
          Nothing yet. Tell NOVA something durable — a dislike, an allergy, how you
          shop — and it will keep it for later conversations.
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          onAdd(draft)
          setDraft('')
        }}
        className="flex gap-1.5"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add something to remember…"
          aria-label="Add a memory"
          className="hud-num min-w-0 flex-1 rounded-lg border border-[var(--hud-line-soft)] bg-transparent px-2 py-1.5 text-[0.75rem] text-[var(--hud-ink)] outline-none placeholder:text-[var(--hud-faint)]"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Remember this"
          className="press grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-[var(--hud-line-soft)] text-[var(--hud-cyan)] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <IconPlus width={14} height={14} />
        </button>
      </form>
    </section>
  )
}
