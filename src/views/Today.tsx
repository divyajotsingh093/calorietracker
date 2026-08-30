import { useMemo, useState } from 'react'
import { CalorieRing, MacroBar, SplitBar } from '@/components/Rings'
import { RecipeDetail, RecipePicker } from '@/components/RecipeSheet'
import {
  IconCamera,
  IconCheck,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconLink,
  IconPlus,
  IconTrash,
} from '@/components/icons'
import { Button, Card, Empty, Tag, cx } from '@/components/ui'
import { addDays, longDate, todayISO } from '@/lib/date'
import { dayTotals, entryMacros } from '@/lib/nutrition'
import { SLOTS, SLOT_META } from '@/lib/slots'
import { useStore } from '@/lib/store'
import type { MealSlot, Recipe } from '@/types'

export function Today({ onSnap }: { onSnap: () => void }) {
  const { state, recipeMap, addPlanEntry, removePlanEntry, toggleEaten, updatePlanEntry, removePhoto } =
    useStore()
  const [date, setDate] = useState(todayISO())
  const [picking, setPicking] = useState<MealSlot | null>(null)
  const [detail, setDetail] = useState<Recipe | null>(null)

  const { settings, plan, photos } = state

  const eaten = useMemo(
    () => dayTotals(date, plan, photos, recipeMap, 'eaten'),
    [date, plan, photos, recipeMap],
  )
  const planned = useMemo(
    () => dayTotals(date, plan, photos, recipeMap, 'planned'),
    [date, plan, photos, recipeMap],
  )

  const dayPhotos = photos.filter((p) => p.date === date)
  const isToday = date === todayISO()

  const mealsFor = (slot: MealSlot) => plan.filter((e) => e.date === date && e.slot === slot)
  const photosFor = (slot: MealSlot) => dayPhotos.filter((p) => p.slot === slot)

  return (
    <div className="animate-rise space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {isToday ? 'Today' : longDate(date)}
          </h1>
          <p className="mt-0.5 text-[13px] text-white/45">
            {isToday ? longDate(date) : 'Browsing another day'}
            {settings.name ? ` · ${settings.name}` : ''}
          </p>
        </div>
        <div className="glass flex items-center gap-1 rounded-full p-1">
          <button
            aria-label="Previous day"
            onClick={() => setDate(addDays(date, -1))}
            className="grid size-9 place-items-center rounded-full text-white/60 transition hover:bg-white/12 hover:text-white cursor-pointer"
          >
            <IconChevronLeft width={18} height={18} />
          </button>
          <button
            onClick={() => setDate(todayISO())}
            className={cx(
              'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition cursor-pointer',
              isToday ? 'text-white/40' : 'bg-white text-ink-950',
            )}
          >
            Today
          </button>
          <button
            aria-label="Next day"
            onClick={() => setDate(addDays(date, 1))}
            className="grid size-9 place-items-center rounded-full text-white/60 transition hover:bg-white/12 hover:text-white cursor-pointer"
          >
            <IconChevronRight width={18} height={18} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <Card className="overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[auto_1fr] lg:items-center">
          <div className="flex justify-center">
            <CalorieRing value={eaten.calories} goal={settings.calorieGoal} />
          </div>
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <MacroBar
                label="Protein"
                value={eaten.protein}
                goal={settings.proteinGoal}
                color="bg-gradient-to-r from-sky-300 to-cyan-300"
              />
              <MacroBar
                label="Carbs"
                value={eaten.carbs}
                goal={settings.carbGoal}
                color="bg-gradient-to-r from-lime-300 to-emerald-300"
              />
              <MacroBar
                label="Fat"
                value={eaten.fat}
                goal={settings.fatGoal}
                color="bg-gradient-to-r from-orange-300 to-amber-300"
              />
              <div className="rounded-2xl bg-white/5 px-3.5 py-2.5">
                <div className="text-[12px] uppercase tracking-[0.08em] text-white/45">
                  Planned for the day
                </div>
                <div className="mt-0.5 font-display text-lg font-semibold tabular-nums">
                  {Math.round(planned.calories)}
                  <span className="text-[13px] font-normal text-white/40"> kcal on the plan</span>
                </div>
              </div>
            </div>
            <Button variant="primary" onClick={onSnap} className="w-full sm:w-auto">
              <IconCamera width={18} height={18} /> Snap a meal to log it
            </Button>
          </div>
        </div>
      </Card>

      {/* Meals */}
      <div className="grid gap-4 lg:grid-cols-2">
        {SLOTS.map((slot) => {
          const meta = SLOT_META[slot]
          const entries = mealsFor(slot)
          const snaps = photosFor(slot)
          const slotKcal =
            entries.reduce((n, e) => n + entryMacros(e, recipeMap).calories, 0) +
            snaps.reduce((n, p) => n + p.calories, 0)

          return (
            <Card key={slot} className={cx('bg-gradient-to-br p-4 sm:p-5', meta.accent)}>
              <div className="mb-3.5 flex items-center gap-3">
                <span className="text-lg">{meta.emoji}</span>
                <div className="flex-1">
                  <h2 className="font-display font-semibold tracking-tight">{meta.label}</h2>
                  <p className="text-[12px] text-white/40">{meta.time}</p>
                </div>
                <span className="font-display text-sm font-semibold tabular-nums text-white/70">
                  {Math.round(slotKcal)} kcal
                </span>
              </div>

              <div className="space-y-2">
                {entries.map((entry) => {
                  const recipe = recipeMap.get(entry.recipeId)
                  if (!recipe) return null
                  const m = entryMacros(entry, recipeMap)
                  return (
                    <div
                      key={entry.id}
                      className={cx(
                        'group flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition',
                        entry.eaten
                          ? 'border-lime-300/25 bg-lime-300/10'
                          : 'border-white/10 bg-white/5',
                      )}
                    >
                      <button
                        onClick={() => toggleEaten(entry.id)}
                        aria-label={entry.eaten ? 'Mark not eaten' : 'Mark as eaten'}
                        className={cx(
                          'grid size-8 shrink-0 place-items-center rounded-full border transition cursor-pointer',
                          entry.eaten
                            ? 'border-lime-300 bg-lime-300 text-ink-950'
                            : 'border-white/25 text-transparent hover:border-lime-300/60 hover:text-lime-300/50',
                        )}
                      >
                        <IconCheck width={16} height={16} />
                      </button>

                      <button
                        onClick={() => setDetail(recipe)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span
                          className={cx(
                            'block truncate text-sm font-medium',
                            entry.eaten && 'text-white/60 line-through decoration-white/25',
                          )}
                        >
                          {recipe.emoji} {recipe.name}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[12px] text-white/45">
                          <span className="tabular-nums">{Math.round(m.calories)} kcal</span>
                          <span>·</span>
                          <span className="tabular-nums">{Math.round(m.protein)}g P</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <IconClock width={11} height={11} />
                            {recipe.minutes}m
                          </span>
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        <div className="glass hidden items-center rounded-full px-1 sm:flex">
                          <button
                            className="size-6 rounded-full text-white/60 transition hover:bg-white/15 cursor-pointer"
                            onClick={() =>
                              updatePlanEntry(entry.id, {
                                servings: Math.max(0.5, entry.servings - 0.5),
                              })
                            }
                          >
                            –
                          </button>
                          <span className="w-8 text-center text-[12px] tabular-nums text-white/70">
                            {entry.servings}×
                          </span>
                          <button
                            className="size-6 rounded-full text-white/60 transition hover:bg-white/15 cursor-pointer"
                            onClick={() =>
                              updatePlanEntry(entry.id, { servings: entry.servings + 0.5 })
                            }
                          >
                            +
                          </button>
                        </div>
                        {recipe.link && (
                          <a
                            href={recipe.link}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label="Open recipe link"
                            className="grid size-8 place-items-center rounded-full text-white/30 transition hover:bg-white/10 hover:text-white"
                          >
                            <IconLink width={15} height={15} />
                          </a>
                        )}
                        <button
                          aria-label="Remove from plan"
                          onClick={() => removePlanEntry(entry.id)}
                          className="grid size-8 place-items-center rounded-full text-white/25 opacity-0 transition hover:bg-rose-500/15 hover:text-rose-300 focus:opacity-100 group-hover:opacity-100 cursor-pointer"
                        >
                          <IconTrash width={15} height={15} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {snaps.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/8 px-3 py-2.5"
                  >
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.label}
                        className="size-9 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10">
                        <IconCamera width={16} height={16} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.label}</span>
                      <span className="mt-0.5 flex items-center gap-2 text-[12px] text-white/45">
                        <span className="tabular-nums">{p.calories} kcal</span>
                        <span>·</span>
                        <span className="tabular-nums">{Math.round(p.protein)}g P</span>
                        <Tag className="ml-1 bg-fuchsia-300/15 text-fuchsia-100/80">
                          {p.source === 'ai' ? 'photo · AI' : p.source === 'estimate' ? 'photo · est.' : 'manual'}
                        </Tag>
                      </span>
                    </div>
                    <button
                      aria-label="Delete log"
                      onClick={() => removePhoto(p.id)}
                      className="grid size-8 shrink-0 place-items-center rounded-full text-white/25 opacity-0 transition hover:bg-rose-500/15 hover:text-rose-300 focus:opacity-100 group-hover:opacity-100 cursor-pointer"
                    >
                      <IconTrash width={15} height={15} />
                    </button>
                  </div>
                ))}

                {!entries.length && !snaps.length && (
                  <p className="rounded-2xl border border-dashed border-white/12 px-3 py-4 text-center text-[13px] text-white/35">
                    Nothing planned yet
                  </p>
                )}

                <button
                  onClick={() => setPicking(slot)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 px-3 py-2.5 text-[13px] text-white/50 transition hover:border-lime-300/40 hover:bg-white/5 hover:text-white cursor-pointer"
                >
                  <IconPlus width={15} height={15} /> Add to {meta.label.toLowerCase()}
                </button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Day macro split */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-white/60">
            Where today&apos;s calories came from
          </h2>
          <div className="flex gap-3 text-[12px] text-white/45">
            <span className="inline-flex items-center gap-1.5">
              <i className="size-2 rounded-full bg-sky-300" /> protein
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="size-2 rounded-full bg-lime-300" /> carbs
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i className="size-2 rounded-full bg-orange-300" /> fat
            </span>
          </div>
        </div>
        <SplitBar protein={eaten.protein * 4} carbs={eaten.carbs * 4} fat={eaten.fat * 9} />
        {eaten.calories === 0 && (
          <Empty
            emoji="🍽️"
            title="Nothing logged yet"
            hint="Tick a planned meal off, or snap a photo of what you actually ate."
          />
        )}
      </Card>

      <RecipePicker
        open={picking !== null}
        onClose={() => setPicking(null)}
        recipes={state.recipes}
        slot={picking}
        onPick={(r) => picking && addPlanEntry(date, picking, r.id)}
      />
      {detail && <RecipeDetail recipe={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}
