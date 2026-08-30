import { useMemo, useState } from 'react'
import { Avatar, ScopeSwitcher } from '@/components/ProfileBits'
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
import { Button, Card, Tag, cx, type as t } from '@/components/ui'
import { addDays, longDate, todayISO } from '@/lib/date'
import { dayTotals, entryMacros } from '@/lib/nutrition'
import { SLOTS, SLOT_META, tintStyle } from '@/lib/slots'
import { useStore } from '@/lib/store'
import type { MealSlot, PlanEntry, Profile, Recipe } from '@/types'

/** One dish in one slot, with everyone eating it. */
interface MealGroup {
  key: string
  recipe: Recipe
  entries: PlanEntry[]
}

export function Today({ onSnap }: { onSnap: () => void }) {
  const {
    state,
    recipeMap,
    scoped,
    addPlanEntry,
    removePlanEntry,
    toggleEaten,
    updatePlanEntry,
    removePhoto,
    setScope,
  } = useStore()
  const [date, setDate] = useState(todayISO())
  const [picking, setPicking] = useState<MealSlot | null>(null)
  const [detail, setDetail] = useState<Recipe | null>(null)

  const { plan, photos, profiles } = state
  const isToday = date === todayISO()
  const multi = scoped.length > 1

  const groupsFor = (slot: MealSlot): MealGroup[] => {
    const map = new Map<string, MealGroup>()
    for (const e of plan) {
      if (e.date !== date || e.slot !== slot) continue
      if (!scoped.some((p) => p.id === e.profileId)) continue
      const recipe = recipeMap.get(e.recipeId)
      if (!recipe) continue
      const existing = map.get(e.recipeId)
      if (existing) existing.entries.push(e)
      else map.set(e.recipeId, { key: e.recipeId, recipe, entries: [e] })
    }
    return [...map.values()]
  }

  const photosFor = (slot: MealSlot) =>
    photos.filter(
      (p) => p.date === date && p.slot === slot && scoped.some((x) => x.id === p.profileId),
    )

  const profileOf = (id: string) => profiles.find((p) => p.id === id)

  return (
    <div className="animate-rise space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={t.displayXl}>
            {isToday ? 'Today' : longDate(date)}
          </h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {isToday ? longDate(date) : 'Browsing another day'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ScopeSwitcher profiles={profiles} scope={state.scope} onChange={setScope} />
          <div className="glass flex items-center gap-1 rounded-full p-1">
            <button
              aria-label="Previous day"
              onClick={() => setDate(addDays(date, -1))}
              className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-fill-hover hover:text-ink cursor-pointer"
            >
              <IconChevronLeft width={18} height={18} />
            </button>
            <button
              onClick={() => setDate(todayISO())}
              className={cx(
                'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition cursor-pointer',
                isToday ? 'text-faint' : 'bg-invert text-on-accent',
              )}
            >
              Today
            </button>
            <button
              aria-label="Next day"
              onClick={() => setDate(addDays(date, 1))}
              className="grid size-9 place-items-center rounded-full text-muted transition hover:bg-fill-hover hover:text-ink cursor-pointer"
            >
              <IconChevronRight width={18} height={18} />
            </button>
          </div>
        </div>
      </div>

      {/* One summary per person in view */}
      <div className={cx('stagger grid gap-4', multi && 'lg:grid-cols-2')}>
        {scoped.map((profile, i) => (
          <div key={profile.id} style={{ '--i': i } as React.CSSProperties}>
            <DaySummary profile={profile} date={date} compact={multi} />
          </div>
        ))}
      </div>

      <Button variant="primary" onClick={onSnap} className="w-full sm:w-auto">
        <IconCamera width={18} height={18} /> Snap a meal to log it
      </Button>

      {/* Meals */}
      <div className="stagger grid gap-4 lg:grid-cols-2">
        {SLOTS.map((slot, slotIndex) => {
          const meta = SLOT_META[slot]
          const groups = groupsFor(slot)
          const snaps = photosFor(slot)

          return (
            <Card
              key={slot}
              className="wash p-4 sm:p-5"
              style={{ ...tintStyle(meta.tint), '--i': slotIndex } as React.CSSProperties}
            >
              <div className="mb-3.5 flex items-center gap-3">
                <span className="text-lg">{meta.emoji}</span>
                <div className="flex-1">
                  <h2 className={t.displayM}>{meta.label}</h2>
                  <p className="text-[0.75rem] text-faint">{meta.time}</p>
                </div>
                <div className="flex gap-2">
                  {scoped.map((p) => {
                    const kcal =
                      groups
                        .flatMap((g) => g.entries)
                        .filter((e) => e.profileId === p.id)
                        .reduce((n, e) => n + entryMacros(e, recipeMap).calories, 0) +
                      snaps.filter((s) => s.profileId === p.id).reduce((n, s) => n + s.calories, 0)
                    return (
                      <span
                        key={p.id}
                        className="flex items-center gap-1.5 rounded-full bg-fill py-0.5 pl-0.5 pr-2"
                      >
                        {multi && <Avatar profile={p} size="sm" />}
                        <span className="font-display text-[13px] font-semibold tabular-nums text-soft">
                          {Math.round(kcal)}
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                {groups.map((group) => {
                  const allEaten = group.entries.every((e) => e.eaten)
                  const first = group.entries[0]
                  const m = entryMacros(first, recipeMap)
                  return (
                    <div
                      key={group.key}
                      className={cx(
                        'group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-3 py-2.5 transition',
                        allEaten
                          ? 'border-accent/25 bg-accent-wash'
                          : 'border-line bg-fill',
                      )}
                    >
                      {multi ? (
                        <div className="flex shrink-0 gap-1.5">
                          {group.entries.map((e) => {
                            const p = profileOf(e.profileId)
                            if (!p) return null
                            return (
                              <button
                                key={e.id}
                                onClick={() => toggleEaten(e.id)}
                                title={`${p.name} — ${e.eaten ? 'eaten' : 'not yet'}`}
                                className={cx(
                                  'grid size-8 place-items-center rounded-full border transition cursor-pointer',
                                  e.eaten
                                    ? 'border-accent bg-accent text-on-accent'
                                    : 'border-line-strong hover:border-accent-line',
                                )}
                              >
                                {e.eaten ? (
                                  <IconCheck width={15} height={15} />
                                ) : (
                                  <span className="text-[13px]">{p.emoji}</span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <button
                          onClick={() => toggleEaten(first.id)}
                          aria-label={first.eaten ? 'Mark not eaten' : 'Mark as eaten'}
                          className={cx(
                            'grid size-8 shrink-0 place-items-center rounded-full border transition cursor-pointer',
                            first.eaten
                              ? 'border-accent bg-accent text-on-accent'
                              : 'border-line-strong text-transparent hover:border-accent-line hover:text-accent/50',
                          )}
                        >
                          <IconCheck width={16} height={16} />
                        </button>
                      )}

                      <button
                        onClick={() => setDetail(group.recipe)}
                        className="min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <span
                          className={cx(
                            'block truncate text-sm font-medium',
                            allEaten && 'text-muted line-through decoration-faint',
                          )}
                        >
                          {group.recipe.emoji} {group.recipe.name}
                        </span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-muted">
                          <span className="tabular-nums">{Math.round(m.calories)} kcal</span>
                          <span>·</span>
                          <span className="tabular-nums">{Math.round(m.protein)}g P</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <IconClock width={11} height={11} />
                            {group.recipe.minutes}m
                          </span>
                          {multi && group.entries.length === 1 && (
                            <>
                              <span>·</span>
                              <span className="text-muted">
                                {profileOf(first.profileId)?.name} only
                              </span>
                            </>
                          )}
                        </span>
                      </button>

                      <div className="flex shrink-0 items-center gap-1">
                        <div className="glass hidden items-center rounded-full px-1 sm:flex">
                          <button
                            aria-label="Fewer servings"
                            className="size-7 rounded-full text-muted transition hover:bg-fill-strong cursor-pointer"
                            onClick={() =>
                              group.entries.forEach((e) =>
                                updatePlanEntry(e.id, {
                                  servings: Math.max(0.5, e.servings - 0.5),
                                }),
                              )
                            }
                          >
                            –
                          </button>
                          <span className="w-8 text-center text-[12px] tabular-nums text-soft">
                            {first.servings}×
                          </span>
                          <button
                            aria-label="More servings"
                            className="size-7 rounded-full text-muted transition hover:bg-fill-strong cursor-pointer"
                            onClick={() =>
                              group.entries.forEach((e) =>
                                updatePlanEntry(e.id, { servings: e.servings + 0.5 }),
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                        {group.recipe.link && (
                          <a
                            href={group.recipe.link}
                            target="_blank"
                            rel="noreferrer noopener"
                            aria-label="Open recipe link"
                            className="grid size-9 place-items-center rounded-full text-faint transition hover:bg-fill-hover hover:text-ink"
                          >
                            <IconLink width={15} height={15} />
                          </a>
                        )}
                        <button
                          aria-label="Remove from plan"
                          onClick={() => group.entries.forEach((e) => removePlanEntry(e.id))}
                          className="grid size-9 place-items-center rounded-full text-faint transition hover:bg-danger-wash hover:text-danger cursor-pointer"
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
                    className="flex items-center gap-3 rounded-2xl border border-line bg-fill px-3 py-2.5"
                  >
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.label}
                        className="size-9 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-fill-hover">
                        <IconCamera width={16} height={16} />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium capitalize">
                        {p.label}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.75rem] text-muted">
                        <span className="tabular-nums">{p.calories} kcal</span>
                        <span>·</span>
                        <span className="tabular-nums">{Math.round(p.protein)}g P</span>
                        {multi && <Tag>{profileOf(p.profileId)?.name}</Tag>}
                        <Tag className="bg-accent-wash text-accent-ink">
                          {p.source === 'ai'
                            ? 'photo · AI'
                            : p.source === 'estimate'
                              ? 'photo · est.'
                              : 'manual'}
                        </Tag>
                      </span>
                    </div>
                    <button
                      aria-label="Delete log"
                      onClick={() => removePhoto(p.id)}
                      className="grid size-9 shrink-0 place-items-center rounded-full text-faint transition hover:bg-danger-wash hover:text-danger cursor-pointer"
                    >
                      <IconTrash width={15} height={15} />
                    </button>
                  </div>
                ))}

                {!groups.length && !snaps.length && (
                  <p className="rounded-2xl border border-dashed border-line px-3 py-4 text-center text-[0.8125rem] text-faint">
                    Nothing planned yet
                  </p>
                )}

                <button
                  onClick={() => setPicking(slot)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line px-3 py-3 text-[0.8125rem] text-muted transition hover:border-accent-line hover:bg-fill hover:text-ink cursor-pointer"
                >
                  <IconPlus width={15} height={15} /> Add to {meta.label.toLowerCase()}
                </button>
              </div>
            </Card>
          )
        })}
      </div>

      {picking && (
        <RecipePicker
          open
          onClose={() => setPicking(null)}
          recipes={state.recipes}
          slot={picking}
          targets={scoped}
          onPick={(r, ids) => addPlanEntry(date, picking, r.id, ids)}
        />
      )}
      {detail && <RecipeDetail recipe={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function DaySummary({
  profile,
  date,
  compact,
}: {
  profile: Profile
  date: string
  compact: boolean
}) {
  const { state, recipeMap } = useStore()
  const eaten = useMemo(
    () => dayTotals(date, profile.id, state.plan, state.photos, recipeMap, 'eaten'),
    [date, profile.id, state.plan, state.photos, recipeMap],
  )
  const planned = useMemo(
    () => dayTotals(date, profile.id, state.plan, state.photos, recipeMap, 'planned'),
    [date, profile.id, state.plan, state.photos, recipeMap],
  )

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        <Avatar profile={profile} />
        <div className="flex-1">
          <h2 className={t.displayM}>{profile.name}</h2>
          <p className="text-[0.75rem] text-faint">
            {profile.diet === 'vegetarian' ? 'Vegetarian · no egg' : 'Eats everything'}
          </p>
        </div>
        <span
          className={cx(
            'rounded-full px-2.5 py-1 text-[12px] tabular-nums',
            planned.calories > profile.calorieGoal
              ? 'bg-warn-wash text-fat'
              : 'bg-accent-wash text-accent-ink',
          )}
        >
          {Math.round(planned.calories)} planned
        </span>
      </div>

      <div
        className={cx(
          'flex flex-col items-center gap-5',
          compact ? 'sm:flex-row' : 'lg:flex-row lg:gap-8',
        )}
      >
        <CalorieRing
          value={eaten.calories}
          goal={profile.calorieGoal}
          size={compact ? 150 : 180}
          stroke={compact ? 13 : 16}
        />
        <div className="w-full flex-1 space-y-3">
          <MacroBar
            label="Protein"
            value={eaten.protein}
            goal={profile.proteinGoal}
            tone="protein"
          />
          <MacroBar
            label="Carbs"
            value={eaten.carbs}
            goal={profile.carbGoal}
            tone="carbs"
          />
          <MacroBar
            label="Fat"
            value={eaten.fat}
            goal={profile.fatGoal}
            tone="fat"
          />
          <div className="pt-1">
            <div className={cx('mb-1.5 text-faint', t.micro)}>Calorie split</div>
            <SplitBar protein={eaten.protein * 4} carbs={eaten.carbs * 4} fat={eaten.fat * 9} />
          </div>
        </div>
      </div>

      {eaten.calories === 0 && (
        <p className="mt-4 rounded-2xl bg-fill px-3.5 py-2.5 text-[0.8125rem] text-faint">
          🍽️ Nothing logged yet — tick a meal off below, or snap a photo.
        </p>
      )}
    </Card>
  )
}
