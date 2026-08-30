import { useMemo, useState } from 'react'
import { RecipeDetail } from '@/components/RecipeSheet'
import { RecipeEditor } from '@/components/RecipeEditor'
import { IconClock, IconLink, IconPlus, IconSearch } from '@/components/icons'
import { Button, Card, Chip, Empty, Input, Tag, cx } from '@/components/ui'
import { SLOTS, SLOT_META } from '@/lib/slots'
import { suitsDiet } from '@/lib/profiles'
import { useStore } from '@/lib/store'
import type { Cuisine, MealSlot, Recipe } from '@/types'

const CUISINES: Cuisine[] = [
  'Indian',
  'Asian',
  'Middle Eastern',
  'Italian',
  'Continental',
  'Mexican',
  'Salads',
]

export function Recipes() {
  const { state, saveRecipe, deleteRecipe } = useStore()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<MealSlot | 'all' | 'mine'>('all')
  const [cuisine, setCuisine] = useState<Cuisine | 'all'>('all')
  const [vegOnly, setVegOnly] = useState(false)
  const [detail, setDetail] = useState<Recipe | null>(null)
  const [editing, setEditing] = useState<Recipe | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.recipes
      .filter((r) =>
        filter === 'all' ? true : filter === 'mine' ? r.custom : r.slots.includes(filter),
      )
      .filter((r) => cuisine === 'all' || r.cuisine === cuisine)
      .filter((r) => !vegOnly || suitsDiet(r, 'vegetarian'))
      .filter(
        (r) =>
          !needle ||
          r.name.toLowerCase().includes(needle) ||
          r.cuisine.toLowerCase().includes(needle) ||
          r.tags.some((t) => t.includes(needle)) ||
          r.ingredients.some((i) => i.item.includes(needle)),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [state.recipes, filter, cuisine, vegOnly, q])

  const openEditor = (recipe: Recipe | null) => {
    setEditing(recipe)
    setEditorOpen(true)
  }

  return (
    <div className="animate-rise space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Dish library
          </h1>
          <p className="mt-0.5 text-[13px] text-white/45">
            {shown.length} of {state.recipes.length} dishes ·{' '}
            {state.recipes.filter((r) => suitsDiet(r, 'vegetarian')).length} suit a vegetarian,
            egg-free diet
          </p>
        </div>
        <Button variant="primary" onClick={() => openEditor(null)}>
          <IconPlus width={17} height={17} /> New dish
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <IconSearch
            width={16}
            height={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, tag or ingredient…"
            className="pl-10"
          />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </Chip>
          {SLOTS.map((s) => (
            <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
              {SLOT_META[s].emoji} {SLOT_META[s].label}
            </Chip>
          ))}
          <Chip active={filter === 'mine'} onClick={() => setFilter('mine')}>
            ✨ Mine
          </Chip>
        </div>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        <Chip active={cuisine === 'all'} onClick={() => setCuisine('all')}>
          Any cuisine
        </Chip>
        {CUISINES.map((c) => (
          <Chip key={c} active={cuisine === c} onClick={() => setCuisine(c)}>
            {c}
          </Chip>
        ))}
        <Chip active={vegOnly} onClick={() => setVegOnly((v) => !v)}>
          🌿 Veg &amp; egg-free
        </Chip>
      </div>

      {shown.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => (
            <Card
              key={r.id}
              className="group flex cursor-pointer flex-col p-4 transition hover:bg-white/10"
              onClick={() => setDetail(r)}
            >
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-white/12 to-white/5 text-2xl">
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-display font-semibold tracking-tight">{r.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {r.slots.map((s) => (
                      <span
                        key={s}
                        className={cx(
                          'rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-white/55',
                        )}
                      >
                        {SLOT_META[s].emoji} {SLOT_META[s].label}
                      </span>
                    ))}
                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-white/55">
                      {r.cuisine}
                    </span>
                    {suitsDiet(r, 'vegetarian') ? (
                      <span className="rounded-full bg-lime-300/15 px-2 py-0.5 text-[11px] text-lime-200">
                        🌿 veg
                      </span>
                    ) : (
                      <span className="rounded-full bg-rose-400/12 px-2 py-0.5 text-[11px] text-rose-200/90">
                        {r.contains.includes('meat')
                          ? 'meat'
                          : r.contains.includes('fish')
                            ? 'fish'
                            : 'egg'}
                      </span>
                    )}
                    {r.custom && (
                      <span className="rounded-full bg-white/12 px-2 py-0.5 text-[11px] text-white/70">
                        yours
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-1.5 text-center">
                {[
                  { v: r.calories, l: 'kcal', c: 'text-lime-200' },
                  { v: r.protein, l: 'protein', c: 'text-sky-200' },
                  { v: r.carbs, l: 'carbs', c: 'text-amber-200' },
                  { v: r.fat, l: 'fat', c: 'text-orange-200' },
                ].map((m) => (
                  <div key={m.l} className="rounded-xl bg-white/5 py-1.5">
                    <div className={cx('font-display text-sm font-bold tabular-nums', m.c)}>
                      {m.v}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-white/35">{m.l}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 text-[12px] text-white/40">
                <span className="inline-flex items-center gap-1">
                  <IconClock width={12} height={12} /> {r.minutes} min
                </span>
                <span>·</span>
                <span>{r.ingredients.length} ingredients</span>
                <span>·</span>
                <span>serves {r.servings}</span>
                {r.link && (
                  <IconLink width={12} height={12} className="ml-auto text-white/30" />
                )}
              </div>

              {r.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {r.tags.slice(0, 3).map((t) => (
                    <Tag key={t}>{t}</Tag>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Empty
          emoji="🍳"
          title="No dishes match"
          hint="Clear the search, or add the dish you had in mind."
        />
      )}

      {detail && (
        <RecipeDetail
          recipe={detail}
          onClose={() => setDetail(null)}
          onEdit={(r) => {
            setDetail(null)
            openEditor(r)
          }}
        />
      )}

      {editorOpen && (
        <RecipeEditor
          open
          initial={editing}
          onClose={() => setEditorOpen(false)}
          onSave={saveRecipe}
          onDelete={editing?.custom ? deleteRecipe : undefined}
        />
      )}
    </div>
  )
}
