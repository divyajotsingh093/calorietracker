import { useEffect, useState } from 'react'
import { SettingsSheet } from '@/components/SettingsSheet'
import {
  IconBook,
  IconCalendar,
  IconCamera,
  IconCart,
  IconFlame,
  IconSettings,
} from '@/components/icons'
import { cx } from '@/components/ui'
import { todayISO } from '@/lib/date'
import { dayTotals } from '@/lib/nutrition'
import { StoreProvider, useStore } from '@/lib/store'
import { Grocery } from '@/views/Grocery'
import { Planner } from '@/views/Planner'
import { Recipes } from '@/views/Recipes'
import { Snap } from '@/views/Snap'
import { Today } from '@/views/Today'

type TabId = 'today' | 'plan' | 'recipes' | 'grocery' | 'snap'

const TABS: { id: TabId; label: string; icon: typeof IconFlame }[] = [
  { id: 'today', label: 'Today', icon: IconFlame },
  { id: 'plan', label: 'Plan', icon: IconCalendar },
  { id: 'recipes', label: 'Dishes', icon: IconBook },
  { id: 'grocery', label: 'Groceries', icon: IconCart },
  { id: 'snap', label: 'Snap', icon: IconCamera },
]

function Shell() {
  const { state, recipeMap } = useStore()
  const [tab, setTab] = useState<TabId>('today')
  const [settingsOpen, setSettingsOpen] = useState(false)

  const eaten = dayTotals(todayISO(), state.plan, state.photos, recipeMap, 'eaten')
  const pct =
    state.settings.calorieGoal > 0
      ? Math.min(100, (eaten.calories / state.settings.calorieGoal) * 100)
      : 0

  // Number keys jump between tabs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      const i = Number(e.key)
      if (i >= 1 && i <= TABS.length) setTab(TABS[i - 1].id)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="min-h-full lg:flex">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-2 border-r border-white/8 p-5 lg:flex print:hidden">
        <div className="mb-6 flex items-center gap-3 px-2">
          <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-lime-300 to-emerald-400 text-xl shadow-[0_12px_30px_-14px_oklch(0.86_0.19_128)]">
            🥗
          </span>
          <div>
            <div className="font-display text-lg font-bold leading-tight tracking-tight">
              Nourish
            </div>
            <div className="text-[12px] text-white/40">meal &amp; calorie tracker</div>
          </div>
        </div>

        {TABS.map(({ id, label, icon: Icon }, i) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cx(
              'group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-sm transition cursor-pointer',
              tab === id
                ? 'glass-strong font-medium text-white'
                : 'text-white/50 hover:bg-white/6 hover:text-white',
            )}
          >
            <Icon
              width={19}
              height={19}
              className={cx(tab === id ? 'text-lime-300' : 'text-white/40')}
            />
            <span className="flex-1">{label}</span>
            <kbd className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-white/30 opacity-0 transition group-hover:opacity-100">
              {i + 1}
            </kbd>
          </button>
        ))}

        <div className="mt-auto space-y-3">
          <div className="glass rounded-2xl p-3.5">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[12px] uppercase tracking-[0.08em] text-white/45">Today</span>
              <span className="text-[13px] tabular-nums text-white/70">
                {Math.round(eaten.calories)}
                <span className="text-white/30">/{state.settings.calorieGoal}</span>
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-lime-300 to-emerald-400 transition-[width] duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm text-white/50 transition hover:bg-white/6 hover:text-white cursor-pointer"
          >
            <IconSettings width={19} height={19} className="text-white/40" />
            Settings
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/8 bg-ink-950/70 px-4 py-3 backdrop-blur-xl lg:hidden print:hidden">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-lime-300 to-emerald-400 text-lg">
            🥗
          </span>
          <div className="flex-1">
            <div className="font-display font-bold leading-tight tracking-tight">Nourish</div>
            <div className="text-[11px] tabular-nums text-white/40">
              {Math.round(eaten.calories)} / {state.settings.calorieGoal} kcal today
            </div>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="grid size-9 place-items-center rounded-xl text-white/50 transition hover:bg-white/8 hover:text-white cursor-pointer"
          >
            <IconSettings width={19} height={19} />
          </button>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">
          {tab === 'today' && <Today onSnap={() => setTab('snap')} />}
          {tab === 'plan' && <Planner />}
          {tab === 'recipes' && <Recipes />}
          {tab === 'grocery' && <Grocery />}
          {tab === 'snap' && <Snap onOpenSettings={() => setSettingsOpen(true)} />}
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden print:hidden">
        <div className="mx-auto flex max-w-lg">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cx(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition cursor-pointer',
                tab === id ? 'text-lime-300' : 'text-white/40',
              )}
            >
              <span
                className={cx(
                  'grid size-9 place-items-center rounded-xl transition',
                  tab === id && 'bg-lime-300/15',
                )}
              >
                <Icon width={19} height={19} />
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
