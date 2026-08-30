import { useMemo, useState } from 'react'
import { IconClock, IconLink, IconPlus, IconSearch } from '@/components/icons'
import { Button, Chip, Empty, Input, Modal, Tag, cx } from '@/components/ui'
import { SLOTS, SLOT_META } from '@/lib/slots'
import { AISLE_META } from '@/lib/grocery'
import { fmtQty } from '@/lib/grocery'
import type { MealSlot, Recipe } from '@/types'

export function RecipeCardMini({ recipe, onClick }: { recipe: Recipe; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="glass group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-white/12 cursor-pointer"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/8 text-xl">
        {recipe.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{recipe.name}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[12px] text-white/45">
          <span className="tabular-nums text-lime-200/80">{recipe.calories} kcal</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <IconClock width={12} height={12} />
            {recipe.minutes}m
          </span>
          <span>·</span>
          <span className="tabular-nums">{recipe.protein}g P</span>
        </span>
      </span>
      <IconPlus
        width={18}
        height={18}
        className="shrink-0 text-white/25 transition group-hover:text-lime-300"
      />
    </button>
  )
}

export function RecipePicker({
  open,
  onClose,
  recipes,
  slot,
  onPick,
  onCreate,
  title,
  subtitle,
}: {
  open: boolean
  onClose: () => void
  recipes: Recipe[]
  slot: MealSlot | null
  onPick: (recipe: Recipe) => void
  onCreate?: () => void
  title?: string
  subtitle?: string
}) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<MealSlot | 'all'>('all')

  const active = slot ?? (filter === 'all' ? null : filter)

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return recipes
      .filter((r) => (active ? r.slots.includes(active) : true))
      .filter(
        (r) =>
          !needle ||
          r.name.toLowerCase().includes(needle) ||
          r.tags.some((t) => t.includes(needle)) ||
          r.ingredients.some((i) => i.item.toLowerCase().includes(needle)),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [recipes, active, q])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? (slot ? `Add ${SLOT_META[slot].label.toLowerCase()}` : 'Pick a dish')}
      subtitle={subtitle ?? `${shown.length} dishes in your library`}
    >
      <div className="space-y-3">
        <div className="relative">
          <IconSearch
            width={16}
            height={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
          />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search dishes, tags or ingredients…"
            className="pl-10"
          />
        </div>

        {!slot && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
              All
            </Chip>
            {SLOTS.map((s) => (
              <Chip key={s} active={filter === s} onClick={() => setFilter(s)}>
                {SLOT_META[s].emoji} {SLOT_META[s].label}
              </Chip>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {shown.map((r) => (
            <RecipeCardMini
              key={r.id}
              recipe={r}
              onClick={() => {
                onPick(r)
                onClose()
              }}
            />
          ))}
          {!shown.length && (
            <Empty emoji="🔍" title="Nothing matches" hint="Try a different word, or add a new dish." />
          )}
        </div>

        {onCreate && (
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              onCreate()
              onClose()
            }}
          >
            <IconPlus width={17} height={17} /> Create a new dish
          </Button>
        )}
      </div>
    </Modal>
  )
}

export function RecipeDetail({
  recipe,
  onClose,
  onEdit,
  servings,
  footer,
}: {
  recipe: Recipe | null
  onClose: () => void
  onEdit?: (r: Recipe) => void
  /** Defaults to the recipe's own batch size, so the method reads as written. */
  servings?: number
  footer?: React.ReactNode
}) {
  const [portions, setPortions] = useState(() => servings ?? recipe?.servings ?? 1)

  if (!recipe) return null
  const factor = portions / Math.max(1, recipe.servings)

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`${recipe.emoji}  ${recipe.name}`}
      subtitle={`${recipe.calories} kcal per serving · ${recipe.minutes} min · makes ${recipe.servings}`}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-2">
          {[
            { k: 'Calories', v: `${Math.round(recipe.calories)}`, u: 'kcal', c: 'text-lime-200' },
            { k: 'Protein', v: `${recipe.protein}`, u: 'g', c: 'text-sky-200' },
            { k: 'Carbs', v: `${recipe.carbs}`, u: 'g', c: 'text-amber-200' },
            { k: 'Fat', v: `${recipe.fat}`, u: 'g', c: 'text-orange-200' },
          ].map((m) => (
            <div key={m.k} className="glass rounded-2xl px-3 py-3 text-center">
              <div className={cx('font-display text-xl font-bold tabular-nums', m.c)}>
                {m.v}
                <span className="text-[11px] font-normal text-white/40">{m.u}</span>
              </div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-white/40">
                {m.k}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {recipe.slots.map((s) => (
            <Tag key={s} className="bg-white/12 text-white/75">
              {SLOT_META[s].emoji} {SLOT_META[s].label}
            </Tag>
          ))}
          {recipe.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-white/70">
              Ingredients
            </h3>
            <div className="flex items-center gap-2 text-[13px] text-white/50">
              <span>Scale to</span>
              <div className="glass flex items-center gap-1 rounded-full px-1 py-0.5">
                <button
                  className="size-6 rounded-full text-white/70 transition hover:bg-white/15 cursor-pointer"
                  onClick={() => setPortions((p) => Math.max(1, p - 1))}
                >
                  –
                </button>
                <span className="w-6 text-center tabular-nums text-white">{portions}</span>
                <button
                  className="size-6 rounded-full text-white/70 transition hover:bg-white/15 cursor-pointer"
                  onClick={() => setPortions((p) => Math.min(20, p + 1))}
                >
                  +
                </button>
              </div>
              <span>servings</span>
            </div>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {recipe.ingredients.map((ing) => (
              <li
                key={ing.item + ing.unit}
                className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-sm"
              >
                <span className="text-sm">{AISLE_META[ing.aisle].emoji}</span>
                <span className="flex-1 text-white/85">{ing.item}</span>
                <span className="tabular-nums text-white/50">
                  {fmtQty(ing.qty * factor)} {ing.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.1em] text-white/70">
            Method
          </h3>
          <ol className="space-y-2.5">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/80">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-lime-300/15 text-[12px] font-semibold text-lime-200">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {recipe.link && (
            <a href={recipe.link} target="_blank" rel="noreferrer noopener" className="inline-flex">
              <Button variant="soft" size="sm">
                <IconLink width={15} height={15} />
                {recipe.linkLabel ?? 'Open recipe'}
              </Button>
            </a>
          )}
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(recipe)}>
              Edit dish
            </Button>
          )}
          <div className="ml-auto flex gap-2">{footer}</div>
        </div>
      </div>
    </Modal>
  )
}
