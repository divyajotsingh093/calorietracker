import { useMemo, useState } from 'react'
import { RecipeDetail, RecipePicker } from '@/components/RecipeSheet'
import { SplitBar } from '@/components/Rings'
import {
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconPlus,
  IconRepeat,
  IconTrash,
} from '@/components/icons'
import { Button, Card, cx } from '@/components/ui'
import {
  addDays,
  currentMondayISO,
  dayName,
  dayNum,
  isWeekend,
  rangeLabel,
  todayISO,
} from '@/lib/date'
import { dayTotals, entryMacros } from '@/lib/nutrition'
import { SLOTS, SLOT_META } from '@/lib/slots'
import { useStore } from '@/lib/store'
import type { MealSlot, Recipe } from '@/types'

interface DragPayload {
  entryId: string
  copy: boolean
}

export function Planner() {
  const {
    state,
    days,
    recipeMap,
    addPlanEntry,
    removePlanEntry,
    movePlanEntry,
    setAnchor,
    copyWeek,
    clearWeek,
    copyDay,
    clearDay,
  } = useStore()

  const [target, setTarget] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [detail, setDetail] = useState<Recipe | null>(null)
  const [drag, setDrag] = useState<DragPayload | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [dayMenu, setDayMenu] = useState<string | null>(null)

  const { plan, photos, settings } = state
  const today = todayISO()

  const totalsByDay = useMemo(() => {
    const map = new Map<string, ReturnType<typeof dayTotals>>()
    for (const d of days) map.set(d, dayTotals(d, plan, photos, recipeMap, 'planned'))
    return map
  }, [days, plan, photos, recipeMap])

  const weekStats = (week: 0 | 1) => {
    const slice = days.slice(week * 7, week * 7 + 7)
    const kcal = slice.reduce((n, d) => n + (totalsByDay.get(d)?.calories ?? 0), 0)
    const meals = plan.filter((e) => slice.includes(e.date)).length
    return { kcal, meals, avg: kcal / 7 }
  }

  const drop = (date: string, slot: MealSlot) => {
    if (!drag) return
    const entry = plan.find((e) => e.id === drag.entryId)
    if (!entry) return
    if (drag.copy) addPlanEntry(date, slot, entry.recipeId, entry.servings)
    else movePlanEntry(entry.id, date, slot)
    setDrag(null)
    setOver(null)
  }

  return (
    <div className="animate-rise space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Two-week plan
          </h1>
          <p className="mt-0.5 text-[13px] text-white/45">
            {rangeLabel(state.anchor, 14)}
            <span className="hidden sm:inline">
              {' '}
              · drag a meal to move it, hold{' '}
              <kbd className="rounded bg-white/10 px-1 py-0.5 text-[11px]">Alt</kbd> while dragging
              to copy
            </span>
            <span className="sm:hidden"> · swipe across the week to see every day</span>
          </p>
        </div>
        <div className="glass flex items-center gap-1 rounded-full p-1">
          <button
            aria-label="Previous fortnight"
            onClick={() => setAnchor(addDays(state.anchor, -14))}
            className="grid size-9 place-items-center rounded-full text-white/60 transition hover:bg-white/12 hover:text-white cursor-pointer"
          >
            <IconChevronLeft width={18} height={18} />
          </button>
          <button
            onClick={() => setAnchor(currentMondayISO())}
            className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/70 transition hover:bg-white/12 cursor-pointer"
          >
            This fortnight
          </button>
          <button
            aria-label="Next fortnight"
            onClick={() => setAnchor(addDays(state.anchor, 14))}
            className="grid size-9 place-items-center rounded-full text-white/60 transition hover:bg-white/12 hover:text-white cursor-pointer"
          >
            <IconChevronRight width={18} height={18} />
          </button>
        </div>
      </div>

      {([0, 1] as const).map((week) => {
        const stats = weekStats(week)
        const weekDays = days.slice(week * 7, week * 7 + 7)

        return (
          <Card key={week} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-lg font-semibold tracking-tight">
                  Week {week + 1}
                </h2>
                <span className="text-[13px] text-white/40">{rangeLabel(weekDays[0], 7)}</span>
              </div>
              <div className="hidden items-center gap-4 text-[13px] text-white/50 sm:flex">
                <span className="tabular-nums">{stats.meals} meals</span>
                <span className="tabular-nums">
                  ⌀ {Math.round(stats.avg)} kcal/day
                  {settings.calorieGoal > 0 && (
                    <span
                      className={cx(
                        'ml-1.5',
                        stats.avg > settings.calorieGoal * 1.08
                          ? 'text-orange-300'
                          : stats.avg < settings.calorieGoal * 0.8
                            ? 'text-sky-300'
                            : 'text-lime-300',
                      )}
                    >
                      {stats.avg > settings.calorieGoal ? '▲' : '▼'}
                      {Math.abs(Math.round(stats.avg - settings.calorieGoal))}
                    </span>
                  )}
                </span>
              </div>
              <div className="ml-auto flex flex-wrap gap-2">
                {week === 0 ? (
                  <Button size="sm" variant="primary" onClick={() => copyWeek(0, 1)}>
                    <IconRepeat width={15} height={15} /> Repeat into week 2
                  </Button>
                ) : (
                  <Button size="sm" variant="soft" onClick={() => copyWeek(1, 0)}>
                    <IconCopy width={15} height={15} /> Copy back to week 1
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => clearWeek(week)}>
                  <IconTrash width={15} height={15} /> Clear
                </Button>
              </div>
            </div>

            <div className="no-scrollbar overflow-x-auto p-3 sm:p-4">
              <div className="grid min-w-[900px] grid-cols-7 gap-2.5">
                {weekDays.map((date) => {
                  const totals = totalsByDay.get(date)!
                  const isNow = date === today
                  return (
                    <div
                      key={date}
                      className={cx(
                        'flex flex-col gap-2 rounded-2xl p-2 transition',
                        isNow
                          ? 'bg-lime-300/10 ring-1 ring-lime-300/30'
                          : isWeekend(date)
                            ? 'bg-white/[0.03]'
                            : '',
                      )}
                    >
                      <div className="relative flex items-baseline justify-between px-1">
                        <div>
                          <div
                            className={cx(
                              'text-[11px] font-semibold uppercase tracking-[0.1em]',
                              isNow ? 'text-lime-300' : 'text-white/40',
                            )}
                          >
                            {dayName(date)}
                          </div>
                          <div className="font-display text-lg font-bold leading-none">
                            {dayNum(date)}
                          </div>
                        </div>
                        <button
                          onClick={() => setDayMenu(dayMenu === date ? null : date)}
                          className="rounded-lg px-1.5 py-0.5 text-[11px] tabular-nums text-white/45 transition hover:bg-white/10 hover:text-white cursor-pointer"
                          title="Day actions"
                        >
                          {Math.round(totals.calories)}
                        </button>
                        {dayMenu === date && (
                          <div className="glass-strong absolute right-0 top-8 z-20 w-44 animate-pop rounded-2xl p-1.5 text-[13px]">
                            <button
                              className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/12 cursor-pointer"
                              onClick={() => {
                                copyDay(date, addDays(date, 7))
                                setDayMenu(null)
                              }}
                            >
                              Copy to next week
                            </button>
                            <button
                              className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/12 cursor-pointer"
                              onClick={() => {
                                copyDay(date, addDays(date, 1))
                                setDayMenu(null)
                              }}
                            >
                              Copy to tomorrow
                            </button>
                            <button
                              className="w-full rounded-xl px-3 py-2 text-left text-rose-200 transition hover:bg-rose-500/15 cursor-pointer"
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

                      <SplitBar
                        protein={totals.protein * 4}
                        carbs={totals.carbs * 4}
                        fat={totals.fat * 9}
                      />

                      {SLOTS.map((slot) => {
                        const cellKey = `${date}|${slot}`
                        const entries = plan.filter((e) => e.date === date && e.slot === slot)
                        return (
                          <div
                            key={slot}
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
                              over === cellKey && 'bg-lime-300/15 ring-1 ring-lime-300/40',
                            )}
                          >
                            <div className="mb-1 flex items-center gap-1.5 px-1">
                              <i className={cx('size-1.5 rounded-full', SLOT_META[slot].dot)} />
                              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-white/30">
                                {SLOT_META[slot].label}
                              </span>
                            </div>

                            <div className="space-y-1">
                              {entries.map((entry) => {
                                const recipe = recipeMap.get(entry.recipeId)
                                if (!recipe) return null
                                const m = entryMacros(entry, recipeMap)
                                return (
                                  <div
                                    key={entry.id}
                                    draggable
                                    onDragStart={(e) => {
                                      setDrag({ entryId: entry.id, copy: e.altKey })
                                      e.dataTransfer.effectAllowed = 'copyMove'
                                    }}
                                    onDragEnd={() => {
                                      setDrag(null)
                                      setOver(null)
                                    }}
                                    className={cx(
                                      'group relative cursor-grab rounded-xl border px-2 py-1.5 transition active:cursor-grabbing',
                                      'border-white/10 bg-white/[0.07] hover:border-white/20 hover:bg-white/12',
                                      drag?.entryId === entry.id && 'opacity-40',
                                    )}
                                    onClick={() => setDetail(recipe)}
                                  >
                                    <div className="flex items-start gap-1.5">
                                      <span className="text-[13px] leading-tight">
                                        {recipe.emoji}
                                      </span>
                                      <span className="line-clamp-2 flex-1 text-[12px] font-medium leading-tight text-white/85">
                                        {recipe.name}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between">
                                      <span className="text-[11px] tabular-nums text-lime-200/70">
                                        {Math.round(m.calories)} kcal
                                      </span>
                                      {entry.servings !== 1 && (
                                        <span className="text-[10px] tabular-nums text-white/40">
                                          {entry.servings}×
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      aria-label="Remove"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        removePlanEntry(entry.id)
                                      }}
                                      className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-ink-800 text-white/50 opacity-0 shadow transition hover:bg-rose-500/80 hover:text-white group-hover:opacity-100 cursor-pointer"
                                    >
                                      <span className="text-[13px] leading-none">×</span>
                                    </button>
                                  </div>
                                )
                              })}

                              <button
                                onClick={() => setTarget({ date, slot })}
                                className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-white/12 py-1.5 text-white/25 transition hover:border-lime-300/40 hover:text-lime-300 cursor-pointer"
                              >
                                <IconPlus width={13} height={13} />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            </div>
          </Card>
        )
      })}

      <RecipePicker
        open={target !== null}
        onClose={() => setTarget(null)}
        recipes={state.recipes}
        slot={target?.slot ?? null}
        onPick={(r) => target && addPlanEntry(target.date, target.slot, r.id)}
      />
      {detail && <RecipeDetail recipe={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
