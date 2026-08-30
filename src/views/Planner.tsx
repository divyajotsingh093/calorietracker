import { useMemo, useState } from 'react'
import { AvatarStack, ScopeSwitcher } from '@/components/ProfileBits'
import { SplitBar } from '@/components/Rings'
import { RecipeDetail, RecipePicker } from '@/components/RecipeSheet'
import {
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconPlus,
  IconRepeat,
  IconTrash,
} from '@/components/icons'
import { Button, Card, cx, type as t } from '@/components/ui'
import {
  addDays,
  currentMondayISO,
  dayName,
  dayNum,
  isWeekend,
  longDate,
  rangeLabel,
  todayISO,
} from '@/lib/date'
import { dayTotals, entryMacros } from '@/lib/nutrition'
import { SLOTS, SLOT_META } from '@/lib/slots'
import { useStore } from '@/lib/store'
import type { MealSlot, PlanEntry, Profile, Recipe } from '@/types'

interface MealGroup {
  key: string
  recipe: Recipe
  entries: PlanEntry[]
  profiles: Profile[]
  kcal: number
}

export function Planner() {
  const {
    state,
    days,
    recipeMap,
    scoped,
    addPlanEntry,
    removePlanEntry,
    movePlanEntry,
    setAnchor,
    setScope,
    copyWeek,
    clearWeek,
    copyDay,
    clearDay,
  } = useStore()

  const [target, setTarget] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [detail, setDetail] = useState<Recipe | null>(null)
  const [drag, setDrag] = useState<{ ids: string[]; copy: boolean } | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [dayMenu, setDayMenu] = useState<string | null>(null)

  const { plan, photos, profiles } = state
  const today = todayISO()
  const multi = scoped.length > 1

  const groupsFor = (date: string, slot: MealSlot): MealGroup[] => {
    const map = new Map<string, MealGroup>()
    for (const e of plan) {
      if (e.date !== date || e.slot !== slot) continue
      const profile = scoped.find((p) => p.id === e.profileId)
      if (!profile) continue
      const recipe = recipeMap.get(e.recipeId)
      if (!recipe) continue
      const existing = map.get(e.recipeId)
      if (existing) {
        existing.entries.push(e)
        existing.profiles.push(profile)
        existing.kcal = entryMacros(e, recipeMap).calories
      } else {
        map.set(e.recipeId, {
          key: `${date}-${slot}-${e.recipeId}`,
          recipe,
          entries: [e],
          profiles: [profile],
          kcal: entryMacros(e, recipeMap).calories,
        })
      }
    }
    return [...map.values()]
  }

  const totalsByDay = useMemo(() => {
    const map = new Map<string, { kcal: number; p: number; c: number; f: number }>()
    for (const d of days) {
      let kcal = 0
      let p = 0
      let c = 0
      let f = 0
      for (const profile of scoped) {
        const t = dayTotals(d, profile.id, plan, photos, recipeMap, 'planned')
        kcal += t.calories
        p += t.protein
        c += t.carbs
        f += t.fat
      }
      // Show the per-person average so the number stays comparable to a goal.
      const n = Math.max(1, scoped.length)
      map.set(d, { kcal: kcal / n, p: p / n, c: c / n, f: f / n })
    }
    return map
  }, [days, scoped, plan, photos, recipeMap])

  const weekStats = (week: 0 | 1) => {
    const slice = days.slice(week * 7, week * 7 + 7)
    const kcal = slice.reduce((n, d) => n + (totalsByDay.get(d)?.kcal ?? 0), 0)
    const meals = plan.filter(
      (e) => slice.includes(e.date) && scoped.some((p) => p.id === e.profileId),
    ).length
    return { kcal, meals, avg: kcal / 7 }
  }

  const goal =
    scoped.reduce((n, p) => n + p.calorieGoal, 0) / Math.max(1, scoped.length)

  const drop = (date: string, slot: MealSlot) => {
    if (!drag) return
    const entries = plan.filter((e) => drag.ids.includes(e.id))
    if (!entries.length) return
    if (drag.copy) {
      for (const e of entries) addPlanEntry(date, slot, e.recipeId, [e.profileId], e.servings)
    } else {
      movePlanEntry(drag.ids, date, slot)
    }
    setDrag(null)
    setOver(null)
  }

  const MealChip = ({ group, compact }: { group: MealGroup; compact: boolean }) => (
    <div
      draggable={compact}
      onDragStart={(e) => {
        setDrag({ ids: group.entries.map((x) => x.id), copy: e.altKey })
        e.dataTransfer.effectAllowed = 'copyMove'
      }}
      onDragEnd={() => {
        setDrag(null)
        setOver(null)
      }}
      onClick={() => setDetail(group.recipe)}
      className={cx(
        'group relative rounded-xl border border-line bg-panel-2 transition hover:border-line-strong hover:bg-fill-hover',
        compact
          ? 'cursor-grab px-2 py-1.5 active:cursor-grabbing'
          : 'cursor-pointer py-2.5 pl-3 pr-12',
        drag?.ids.includes(group.entries[0].id) && 'opacity-40',
      )}
    >
      <div className="flex items-start gap-1.5">
        <span className={compact ? 'text-[13px] leading-tight' : 'text-base'}>
          {group.recipe.emoji}
        </span>
        <span
          title={group.recipe.name}
          className={cx(
            'flex-1 font-medium leading-tight text-ink',
            compact ? 'line-clamp-2 text-[12px]' : 'text-sm',
          )}
        >
          {group.recipe.name}
        </span>
        {multi && <AvatarStack profiles={group.profiles} />}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[11px] tabular-nums text-accent-ink">
          {Math.round(group.kcal)} kcal
        </span>
        {!compact && (
          <span className="text-[0.6875rem] text-faint">{group.recipe.cuisine}</span>
        )}
        {multi && group.profiles.length === 1 && (
          <span className="text-[10px] text-faint">{group.profiles[0].name} only</span>
        )}
      </div>
      <button
        aria-label={`Remove ${group.recipe.name}`}
        onClick={(e) => {
          e.stopPropagation()
          group.entries.forEach((x) => removePlanEntry(x.id))
        }}
        className={cx(
          'absolute grid place-items-center rounded-full bg-panel-3 text-muted shadow transition hover:bg-danger hover:text-ink cursor-pointer',
          compact
            ? '-right-1 -top-1 size-5 opacity-0 group-hover:opacity-100'
            : 'right-1.5 top-1.5 size-7',
        )}
      >
        <span className="text-[13px] leading-none">×</span>
      </button>
    </div>
  )

  const SlotCell = ({
    date,
    slot,
    compact,
  }: {
    date: string
    slot: MealSlot
    compact: boolean
  }) => {
    const cellKey = `${date}|${slot}`
    const groups = groupsFor(date, slot)
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(cellKey)
        }}
        onDragLeave={() => setOver((o) => (o === cellKey ? null : o))}
        onDrop={(e) => {
          e.preventDefault()
          drop(date, slot)
        }}
        className={cx(
          'rounded-xl p-1 transition',
          over === cellKey && 'bg-accent-wash ring-1 ring-accent-line',
        )}
      >
        <div className="mb-1 flex items-center gap-1.5 px-1">
          <i
            className="size-1.5 rounded-full"
            style={{ background: SLOT_META[slot].tint }}
          />
          <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-faint">
            {SLOT_META[slot].label}
          </span>
        </div>
        <div className="space-y-1.5">
          {groups.map((g) => (
            <MealChip key={g.key} group={g} compact={compact} />
          ))}
          <button
            onClick={() => setTarget({ date, slot })}
            aria-label={`Add ${SLOT_META[slot].label} on ${longDate(date)}`}
            className={cx(
              'flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-line text-faint transition hover:border-accent-line hover:text-accent-ink cursor-pointer',
              compact ? 'py-1.5' : 'py-2.5',
            )}
          >
            <IconPlus width={13} height={13} />
          </button>
        </div>
      </div>
    )
  }

  const DayHeader = ({ date, compact }: { date: string; compact: boolean }) => {
    const totals = totalsByDay.get(date)!
    const isNow = date === today
    const over2000 = totals.kcal > 2000
    return (
      <div className="relative flex items-baseline justify-between px-1">
        <div>
          <div
            className={cx(
              'text-[11px] font-semibold uppercase tracking-[0.1em]',
              isNow ? 'text-accent-ink' : 'text-faint',
            )}
          >
            {dayName(date)}
          </div>
          <div className={cx('font-display font-bold leading-none', compact ? 'text-lg' : 'text-xl')}>
            {dayNum(date)}
          </div>
        </div>
        <button
          onClick={() => setDayMenu(dayMenu === date ? null : date)}
          title={multi ? 'Average per person · day actions' : 'Day actions'}
          className={cx(
            'rounded-lg px-1.5 py-0.5 text-[11px] tabular-nums transition hover:bg-fill-hover hover:text-ink cursor-pointer',
            over2000 ? 'text-warn' : 'text-muted',
          )}
        >
          {Math.round(totals.kcal)}
        </button>
        {dayMenu === date && (
          <div className="glass-strong absolute right-0 top-8 z-20 w-48 animate-pop rounded-2xl bg-raised p-1.5 text-[13px]">
            <button
              className="w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-fill-hover cursor-pointer"
              onClick={() => {
                copyDay(date, addDays(date, 7))
                setDayMenu(null)
              }}
            >
              Copy to next week
            </button>
            <button
              className="w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-fill-hover cursor-pointer"
              onClick={() => {
                copyDay(date, addDays(date, 1))
                setDayMenu(null)
              }}
            >
              Copy to tomorrow
            </button>
            <button
              className="w-full rounded-xl px-3 py-2.5 text-left text-danger transition hover:bg-danger-wash cursor-pointer"
              onClick={() => {
                clearDay(date)
                setDayMenu(null)
              }}
            >
              Clear this day
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="animate-rise space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={t.displayXl}>
            Two-week plan
          </h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {rangeLabel(state.anchor, 14)}
            <span className="hidden sm:inline">
              {' '}
              · drag a meal to move it, hold{' '}
              <kbd className="rounded bg-fill-hover px-1 py-0.5 text-[11px]">Alt</kbd> while dragging
              to copy
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScopeSwitcher profiles={profiles} scope={state.scope} onChange={setScope} />
          <div className="glass flex items-center gap-1 rounded-full p-1">
            <button
              aria-label="Previous fortnight"
              onClick={() => setAnchor(addDays(state.anchor, -14))}
              className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-fill-hover hover:text-ink cursor-pointer"
            >
              <IconChevronLeft width={18} height={18} />
            </button>
            <button
              onClick={() => setAnchor(currentMondayISO())}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-soft transition hover:bg-fill-hover cursor-pointer"
            >
              This fortnight
            </button>
            <button
              aria-label="Next fortnight"
              onClick={() => setAnchor(addDays(state.anchor, 14))}
              className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-fill-hover hover:text-ink cursor-pointer"
            >
              <IconChevronRight width={18} height={18} />
            </button>
          </div>
        </div>
      </div>

      {([0, 1] as const).map((week) => {
        const stats = weekStats(week)
        const weekDays = days.slice(week * 7, week * 7 + 7)

        return (
          <Card key={week} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 sm:px-5">
              <div className="flex items-baseline gap-3">
                <h2 className={t.displayM}>
                  Week {week + 1}
                </h2>
                <span className="text-[0.8125rem] text-faint">{rangeLabel(weekDays[0], 7)}</span>
              </div>
              <div className="flex items-center gap-4 text-[0.8125rem] text-muted">
                <span className="tabular-nums">{stats.meals} meals</span>
                <span className="tabular-nums">
                  ⌀ {Math.round(stats.avg)} kcal/day
                  <span
                    className={cx(
                      'ml-1.5',
                      stats.avg > 2000
                        ? 'text-warn'
                        : stats.avg > goal
                          ? 'text-carbs'
                          : 'text-accent-ink',
                    )}
                  >
                    {stats.avg > 2000 ? 'over 2000' : 'under 2000'}
                  </span>
                </span>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                {week === 0 ? (
                  <Button size="sm" variant="primary" onClick={() => copyWeek(0, 1)}>
                    <IconRepeat width={15} height={15} />
                    <span className="hidden sm:inline">Repeat into week 2</span>
                    <span className="sm:hidden">Repeat</span>
                  </Button>
                ) : (
                  <Button size="sm" variant="soft" onClick={() => copyWeek(1, 0)}>
                    <IconCopy width={15} height={15} />
                    <span className="hidden sm:inline">Copy back to week 1</span>
                    <span className="sm:hidden">Copy back</span>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => clearWeek(week)}>
                  <IconTrash width={15} height={15} /> Clear
                </Button>
              </div>
            </div>

            {/* Desktop: the whole week side by side */}
            <div className="no-scrollbar hidden overflow-x-auto p-3 sm:block sm:p-4">
              <div className="grid min-w-[920px] grid-cols-7 gap-2.5">
                {weekDays.map((date) => (
                  <div
                    key={date}
                    className={cx(
                      'flex flex-col gap-2 rounded-2xl p-2 transition',
                      date === today
                        ? 'bg-accent-wash ring-1 ring-accent-line'
                        : isWeekend(date)
                          ? 'bg-fill'
                          : '',
                    )}
                  >
                    <DayHeader date={date} compact />
                    <SplitBar
                      protein={(totalsByDay.get(date)?.p ?? 0) * 4}
                      carbs={(totalsByDay.get(date)?.c ?? 0) * 4}
                      fat={(totalsByDay.get(date)?.f ?? 0) * 9}
                    />
                    {SLOTS.map((slot) => (
                      <SlotCell key={slot} date={date} slot={slot} compact />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile: one readable card per day */}
            <div className="space-y-3 p-3 sm:hidden">
              {weekDays.map((date) => (
                <div
                  key={date}
                  className={cx(
                    'rounded-2xl p-3',
                    date === today
                      ? 'bg-accent-wash ring-1 ring-accent-line'
                      : 'bg-fill',
                  )}
                >
                  <DayHeader date={date} compact={false} />
                  <div className="mb-3 mt-2">
                    <SplitBar
                      protein={(totalsByDay.get(date)?.p ?? 0) * 4}
                      carbs={(totalsByDay.get(date)?.c ?? 0) * 4}
                      fat={(totalsByDay.get(date)?.f ?? 0) * 9}
                    />
                  </div>
                  <div className="space-y-2.5">
                    {SLOTS.map((slot) => (
                      <SlotCell key={slot} date={date} slot={slot} compact={false} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      })}

      {target && (
        <RecipePicker
          open
          onClose={() => setTarget(null)}
          recipes={state.recipes}
          slot={target.slot}
          targets={scoped}
          subtitle={longDate(target.date)}
          onPick={(r, ids) => addPlanEntry(target.date, target.slot, r.id, ids)}
        />
      )}
      {detail && <RecipeDetail recipe={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
