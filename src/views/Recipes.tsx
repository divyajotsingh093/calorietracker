import { useMemo, useState } from 'react'
import { RecipeDetail } from '@/components/RecipeSheet'
import { RecipeEditor } from '@/components/RecipeEditor'
import { IconClock, IconLink, IconPlay, IconPlus, IconSearch } from '@/components/icons'
import { Button, Card, Chip, Empty, Input, Tag, cx, type as t } from '@/components/ui'
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
          <h1 className={t.displayXl}>
            Dish library
          </h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
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
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
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
        <div className="stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r, i) => (
            <Card
              key={r.id}
              style={{ '--i': Math.min(i, 11) } as React.CSSProperties}
              className="lift group flex cursor-pointer flex-col p-4"
              onClick={() => setDetail(r)}
            >
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-fill-hover to-fill text-2xl">
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className={cx(t.displayM, 'truncate')}>{r.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {r.slots.map((s) => (
                      <span
                        key={s}
                        className={cx(
                          'rounded-full bg-fill px-2 py-0.5 text-[0.6875rem] text-muted',
                        )}
                      >
                        {SLOT_META[s].emoji} {SLOT_META[s].label}
                      </span>
                    ))}
                    <span className="rounded-full bg-fill px-2 py-0.5 text-[0.6875rem] text-muted">
                      {r.cuisine}
                    </span>
                    {suitsDiet(r, 'vegetarian') ? (
                      <span className="rounded-full bg-accent-wash px-2 py-0.5 text-[11px] text-accent-ink">
                        🌿 veg
                      </span>
                    ) : (
                      <span className="rounded-full bg-danger-wash px-2 py-0.5 text-[11px] text-danger">
                        {r.contains.includes('meat')
                          ? 'meat'
                          : r.contains.includes('fish')
                            ? 'fish'
                            : 'egg'}
                      </span>
                    )}
                    {r.custom && (
                      <span className="rounded-full bg-fill-hover px-2 py-0.5 text-[11px] text-soft">
                        yours
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-1.5 text-center">
                {[
                  { v: r.calories, l: 'kcal', c: 'text-accent-ink' },
                  { v: r.protein, l: 'protein', c: 'text-protein' },
                  { v: r.carbs, l: 'carbs', c: 'text-carbs' },
                  { v: r.fat, l: 'fat', c: 'text-fat' },
                ].map((m) => (
                  <div key={m.l} className="rounded-xl bg-fill py-1.5">
                    <div className={cx('font-display text-sm font-bold tabular-nums', m.c)}>
                      {m.v}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-faint">{m.l}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2 text-[0.75rem] text-faint">
                <span className="inline-flex items-center gap-1">
                  <IconClock width={12} height={12} /> {r.minutes} min
                </span>
                <span>·</span>
                <span>{r.ingredients.length} ingredients</span>
                <span>·</span>
                <span>serves {r.servings}</span>
                <span className="ml-auto flex items-center gap-1.5 text-faint">
                  {r.video && <IconPlay width={13} height={13} />}
                  {r.link && <IconLink width={12} height={12} />}
                </span>
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
