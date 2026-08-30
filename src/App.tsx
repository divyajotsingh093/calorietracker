import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/ProfileBits'
import { SettingsSheet } from '@/components/SettingsSheet'
import { ModeSwitch, ModeToggle } from '@/components/ThemeControls'
import {
  IconBook,
  IconBolt,
  IconCalendar,
  IconCamera,
  IconCart,
  IconFlame,
  IconSettings,
} from '@/components/icons'
import { cx, type as t } from '@/components/ui'
import { todayISO } from '@/lib/date'
import { dayTotals } from '@/lib/nutrition'
import { StoreProvider, useStore } from '@/lib/store'
import { useTheme } from '@/lib/useTheme'
import { Assistant } from '@/views/Assistant'
import { Grocery } from '@/views/Grocery'
import { Planner } from '@/views/Planner'
import { Recipes } from '@/views/Recipes'
import { Snap } from '@/views/Snap'
import { Today } from '@/views/Today'

type TabId = 'today' | 'plan' | 'recipes' | 'grocery' | 'snap' | 'nova'

const TABS: { id: TabId; label: string; icon: typeof IconFlame }[] = [
  { id: 'today', label: 'Today', icon: IconFlame },
  { id: 'plan', label: 'Plan', icon: IconCalendar },
  { id: 'recipes', label: 'Dishes', icon: IconBook },
  { id: 'grocery', label: 'Groceries', icon: IconCart },
  { id: 'snap', label: 'Snap', icon: IconCamera },
  { id: 'nova', label: 'NOVA', icon: IconBolt },
]

function Shell() {
  const { state, recipeMap, scoped } = useStore()
  const theme = useTheme()
  const [tab, setTab] = useState<TabId>('today')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const railRef = useRef<HTMLDivElement>(null)

  const todays = scoped.map((profile) => {
    const eaten = dayTotals(todayISO(), profile.id, state.plan, state.photos, recipeMap, 'eaten')
    return {
      profile,
      eaten: eaten.calories,
      pct:
        profile.calorieGoal > 0 ? Math.min(100, (eaten.calories / profile.calorieGoal) * 100) : 0,
    }
  })

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

  const activeIndex = TABS.findIndex((x) => x.id === tab)

  return (
    <div className="min-h-full lg:flex">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-[17rem] shrink-0 flex-col gap-1 border-r border-line px-4 py-6 lg:flex print:hidden">
        <div className="mb-7 flex items-center gap-3 px-2">
          <span
            className="grid size-11 place-items-center rounded-2xl text-xl shadow-e2"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            🥗
          </span>
          <div>
            <div className="font-display text-[1.25rem] font-semibold leading-tight tracking-[-0.02em]">
              Nourish
            </div>
            <div className="text-[0.75rem] text-faint">meal &amp; calorie tracker</div>
          </div>
        </div>

        <div ref={railRef} className="relative flex flex-col gap-1">
          <span
            aria-hidden
            className="absolute inset-x-0 rounded-2xl bg-accent-wash ring-1 ring-accent-line"
            style={{
              height: '2.875rem',
              top: `calc(${activeIndex} * (2.875rem + 0.25rem))`,
              transition: 'top 0.38s var(--ease-spring)',
            }}
          />
          {TABS.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={cx(
                'group relative z-10 flex h-[2.875rem] cursor-pointer items-center gap-3 rounded-2xl px-3.5 text-left text-[0.875rem] transition-colors duration-200',
                tab === id ? 'font-semibold text-ink' : 'text-muted hover:text-ink',
              )}
            >
              <Icon
                width={19}
                height={19}
                className={cx(
                  'transition-transform duration-300',
                  tab === id ? 'text-accent-ink scale-110' : 'text-faint',
                )}
              />
              <span className="flex-1">{label}</span>
              <kbd className="rounded-md bg-fill px-1.5 py-0.5 text-[0.625rem] text-faint opacity-0 transition-opacity group-hover:opacity-100">
                {i + 1}
              </kbd>
            </button>
          ))}
        </div>

        <div className="mt-auto space-y-3">
          <div className="space-y-3 rounded-2xl border border-line bg-panel p-3.5 shadow-e1">
            <span className={cx('block text-faint', t.micro)}>Today</span>
            {todays.map(({ profile, eaten, pct }) => (
              <div key={profile.id}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Avatar profile={profile} size="sm" />
                  <span className="flex-1 text-[0.8125rem] text-soft">{profile.name}</span>
                  <span className="text-[0.8125rem] tabular-nums text-soft">
                    {Math.round(eaten)}
                    <span className="text-faint">/{profile.calorieGoal}</span>
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ background: 'var(--ring-track)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
                      transition: 'width 0.9s var(--ease-out)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <ModeSwitch mode={theme.mode} onChange={theme.setMode} />

          <button
            onClick={() => setSettingsOpen(true)}
            className="press flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[0.875rem] text-muted hover:bg-fill hover:text-ink"
          >
            <IconSettings width={19} height={19} className="text-faint" />
            Settings
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="veil sticky top-0 z-30 flex items-center gap-3 border-b border-line px-4 py-3 lg:hidden print:hidden">
          <span
            className="grid size-9 place-items-center rounded-xl text-lg shadow-e1"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          >
            🥗
          </span>
          <div className="flex-1">
            <div className="font-display text-[1.0625rem] font-semibold leading-tight tracking-[-0.02em]">
              Nourish
            </div>
            <div className="flex gap-2.5 whitespace-nowrap text-[0.6875rem] tabular-nums text-faint">
              {todays.map(({ profile, eaten }) => (
                <span key={profile.id}>
                  {profile.emoji} {Math.round(eaten)}/{profile.calorieGoal}
                </span>
              ))}
            </div>
          </div>
          <ModeToggle mode={theme.mode} onChange={theme.setMode} />
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="press grid size-10 cursor-pointer place-items-center rounded-xl text-muted hover:bg-fill hover:text-ink"
          >
            <IconSettings width={19} height={19} />
          </button>
        </header>

        <main
          key={tab}
          className="animate-rise mx-auto w-full max-w-[86rem] flex-1 px-4 pb-28 pt-5 sm:px-6 lg:pb-12 lg:pt-9"
        >
          {tab === 'today' && <Today onSnap={() => setTab('snap')} />}
          {tab === 'plan' && <Planner />}
          {tab === 'recipes' && <Recipes />}
          {tab === 'grocery' && <Grocery />}
          {tab === 'snap' && <Snap onOpenSettings={() => setSettingsOpen(true)} />}
          {tab === 'nova' && (
            <Assistant
              onOpenSettings={() => setSettingsOpen(true)}
              onNavigate={setTab}
              theme={theme}
            />
          )}
        </main>
      </div>

      {/* Mobile bottom bar */}
      <nav className="veil fixed inset-x-0 bottom-0 z-30 border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden">
        <div className="mx-auto flex max-w-lg">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={cx(
                'flex flex-1 cursor-pointer flex-col items-center gap-1 py-2 text-[0.6875rem] font-medium transition-colors duration-200',
                tab === id ? 'text-accent-ink' : 'text-faint',
              )}
            >
              <span
                className={cx(
                  'grid size-9 place-items-center rounded-xl transition-all duration-300',
                  tab === id ? 'bg-accent-wash scale-105' : 'scale-100',
                )}
              >
                <Icon width={19} height={19} />
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} theme={theme} />
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
