import { useMemo, useState } from 'react'
import { Avatar } from '@/components/ProfileBits'
import { IconClock, IconLink, IconPlay, IconPlus, IconSearch } from '@/components/icons'
import { Button, Chip, Empty, Input, Modal, Tag, cx, type as t } from '@/components/ui'
import { SLOTS, SLOT_META } from '@/lib/slots'
import { AISLE_META, fmtQty } from '@/lib/grocery'
import { suitsDiet } from '@/lib/profiles'
import type { MealSlot, Profile, Recipe } from '@/types'

const CUISINES = [
  'Indian',
  'Asian',
  'Middle Eastern',
  'Italian',
  'Continental',
  'Mexican',
  'Salads',
] as const

export function RecipeCardMini({
  recipe,
  onClick,
  blockedFor = [],
}: {
  recipe: Recipe
  onClick?: () => void
  /** Profiles whose diet this dish breaks — it will be added only for the rest. */
  blockedFor?: Profile[]
}) {
  return (
    <button
      onClick={onClick}
      className="glass group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition hover:bg-fill-hover cursor-pointer"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-fill text-xl">
        {recipe.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{recipe.name}</span>
          {blockedFor.map((p) => (
            <span
              key={p.id}
              className="shrink-0 rounded-full bg-danger-wash px-2 py-0.5 text-[10px] text-danger"
            >
              not for {p.name}
            </span>
          ))}
        </span>
        <span className="mt-0.5 flex items-center gap-2 text-[0.75rem] text-muted">
          <span className="tabular-nums text-accent-ink">{recipe.calories} kcal</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <IconClock width={12} height={12} />
            {recipe.minutes}m
          </span>
          <span>·</span>
          <span className="tabular-nums">{recipe.protein}g P</span>
          <span>·</span>
          <span>{recipe.cuisine}</span>
        </span>
      </span>
      <IconPlus
        width={18}
        height={18}
        className="shrink-0 text-faint transition group-hover:text-accent-ink"
      />
    </button>
  )
}

export function RecipePicker({
  open,
  onClose,
  recipes,
  slot,
  targets,
  onPick,
  onCreate,
  title,
  subtitle,
}: {
  open: boolean
  onClose: () => void
  recipes: Recipe[]
  slot: MealSlot | null
  /** Who the meal is being planned for. */
  targets: Profile[]
  onPick: (recipe: Recipe, profileIds: string[]) => void
  onCreate?: () => void
  title?: string
  subtitle?: string
}) {
  const [q, setQ] = useState('')
  const [slotFilter, setSlotFilter] = useState<MealSlot | 'all'>('all')
  const [cuisine, setCuisine] = useState<string>('all')
  const [showAll, setShowAll] = useState(false)
  const [chosen, setChosen] = useState<string[]>(() => targets.map((t) => t.id))

  const active = slot ?? (slotFilter === 'all' ? null : slotFilter)

  const forProfiles = useMemo(
    () => targets.filter((t) => chosen.includes(t.id)),
    [targets, chosen],
  )

  const blockedFor = (r: Recipe) => forProfiles.filter((p) => !suitsDiet(r, p.diet))

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return recipes
      .filter((r) => (active ? r.slots.includes(active) : true))
      .filter((r) => cuisine === 'all' || r.cuisine === cuisine)
      .filter((r) => showAll || forProfiles.every((p) => suitsDiet(r, p.diet)))
      .filter(
        (r) =>
          !needle ||
          r.name.toLowerCase().includes(needle) ||
          r.cuisine.toLowerCase().includes(needle) ||
          r.tags.some((t) => t.includes(needle)) ||
          r.ingredients.some((i) => i.item.toLowerCase().includes(needle)),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [recipes, active, cuisine, q, showAll, forProfiles])

  const pick = (r: Recipe) => {
    const eligible = forProfiles.filter((p) => suitsDiet(r, p.diet)).map((p) => p.id)
    if (!eligible.length) return
    onPick(r, eligible)
    onClose()
  }

  const hiddenCount = showAll
    ? 0
    : recipes.filter(
        (r) =>
          (!active || r.slots.includes(active)) &&
          !forProfiles.every((p) => suitsDiet(r, p.diet)),
      ).length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? (slot ? `Add ${SLOT_META[slot].label.toLowerCase()}` : 'Pick a dish')}
      subtitle={subtitle ?? `${shown.length} dishes match`}
    >
      <div className="space-y-3">
        {targets.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-fill px-3 py-2.5">
            <span className="text-[12px] uppercase tracking-[0.08em] text-muted">For</span>
            {targets.map((p) => {
              const on = chosen.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    setChosen((c) =>
                      on ? (c.length > 1 ? c.filter((x) => x !== p.id) : c) : [...c, p.id],
                    )
                  }
                  className={cx(
                    'flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[13px] transition cursor-pointer',
                    on ? 'bg-invert text-on-accent font-medium' : 'bg-fill text-muted',
                  )}
                >
                  <Avatar profile={p} size="sm" />
                  {p.name}
                </button>
              )
            })}
          </div>
        )}

        <div className="relative">
          <IconSearch
            width={16}
            height={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
          />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search dishes, cuisines or ingredients…"
            className="pl-10"
          />
        </div>

        {!slot && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            <Chip active={slotFilter === 'all'} onClick={() => setSlotFilter('all')}>
              All meals
            </Chip>
            {SLOTS.map((s) => (
              <Chip key={s} active={slotFilter === s} onClick={() => setSlotFilter(s)}>
                {SLOT_META[s].emoji} {SLOT_META[s].label}
              </Chip>
            ))}
          </div>
        )}

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <Chip active={cuisine === 'all'} onClick={() => setCuisine('all')}>
            Any cuisine
          </Chip>
          {CUISINES.map((c) => (
            <Chip key={c} active={cuisine === c} onClick={() => setCuisine(c)}>
              {c}
            </Chip>
          ))}
        </div>

        <div className="space-y-2">
          {shown.map((r) => (
            <RecipeCardMini
              key={r.id}
              recipe={r}
              blockedFor={blockedFor(r)}
              onClick={() => pick(r)}
            />
          ))}
          {!shown.length && (
            <Empty
              emoji="🔍"
              title="Nothing matches"
              hint="Try another word or cuisine, or add a new dish."
            />
          )}
        </div>

        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full rounded-2xl border border-dashed border-line px-3 py-2.5 text-[0.8125rem] text-muted transition hover:border-line-strong hover:text-ink cursor-pointer"
          >
            {hiddenCount} more dishes don&apos;t suit{' '}
            {forProfiles
              .map((p) => p.name)
              .join(' and ')}
            &apos;s diet — show them anyway
          </button>
        )}
        {showAll && (
          <button
            onClick={() => setShowAll(false)}
            className="w-full rounded-2xl px-3 py-2 text-[0.8125rem] text-faint transition hover:text-ink cursor-pointer"
          >
            Hide dishes that don&apos;t suit the diet
          </button>
        )}

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
      subtitle={`${recipe.cuisine} · ${recipe.calories} kcal per serving · ${recipe.minutes} min · makes ${recipe.servings}`}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-2">
          {[
            { k: 'Calories', v: `${Math.round(recipe.calories)}`, u: 'kcal', c: 'text-accent-ink' },
            { k: 'Protein', v: `${recipe.protein}`, u: 'g', c: 'text-protein' },
            { k: 'Carbs', v: `${recipe.carbs}`, u: 'g', c: 'text-carbs' },
            { k: 'Fat', v: `${recipe.fat}`, u: 'g', c: 'text-fat' },
          ].map((m) => (
            <div key={m.k} className="glass rounded-2xl px-3 py-3 text-center">
              <div className={cx('font-display text-xl font-bold tabular-nums', m.c)}>
                {m.v}
                <span className="text-[11px] font-normal text-faint">{m.u}</span>
              </div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-faint">
                {m.k}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Tag className="bg-fill-hover text-soft">{recipe.cuisine}</Tag>
          {recipe.slots.map((s) => (
            <Tag key={s} className="bg-fill-hover text-soft">
              {SLOT_META[s].emoji} {SLOT_META[s].label}
            </Tag>
          ))}
          {recipe.contains.length === 0 ? (
            <Tag className="bg-accent-wash text-accent-ink">vegetarian · egg-free</Tag>
          ) : (
            recipe.contains
              .filter((c) => c !== 'dairy')
              .map((c) => (
                <Tag key={c} className="bg-danger-wash text-danger">
                  contains {c}
                </Tag>
              ))
          )}
          {recipe.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className={cx(t.micro, 'text-faint')}>
              Ingredients
            </h3>
            <div className="flex items-center gap-2 text-[0.8125rem] text-muted">
              <span>Scale to</span>
              <div className="glass flex items-center gap-1 rounded-full px-1 py-0.5">
                <button
                  className="size-6 rounded-full text-soft transition hover:bg-fill-strong cursor-pointer"
                  onClick={() => setPortions((p) => Math.max(1, p - 1))}
                >
                  –
                </button>
                <span className="w-6 text-center tabular-nums text-ink">{portions}</span>
                <button
                  className="size-6 rounded-full text-soft transition hover:bg-fill-strong cursor-pointer"
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
                className="flex items-center gap-2.5 rounded-xl bg-fill px-3 py-2 text-sm"
              >
                <span className="text-sm">{AISLE_META[ing.aisle].emoji}</span>
                <span className="flex-1 text-ink">{ing.item}</span>
                <span className="tabular-nums text-muted">
                  {fmtQty(ing.qty * factor)} {ing.unit}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.1em] text-soft">
            Method
          </h3>
          <ol className="space-y-2.5">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-soft">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-wash text-[12px] font-semibold text-accent-ink">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col items-start gap-3 border-t border-line pt-4">
          {recipe.video && (
            <a
              href={recipe.video}
              target="_blank"
              rel="noreferrer noopener"
              className="lift flex w-full items-center gap-3 rounded-2xl border border-line bg-panel-2 p-3"
            >
              <span
                className="grid size-10 shrink-0 place-items-center rounded-xl text-on-accent"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
              >
                <IconPlay width={18} height={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8125rem] font-semibold">Watch how it&apos;s made</span>
                <span className="block truncate text-[0.75rem] text-muted">
                  {recipe.videoTitle ?? recipe.video}
                </span>
              </span>
              <IconLink width={15} height={15} className="shrink-0 text-faint" />
            </a>
          )}

          <div className="flex w-full flex-wrap items-center gap-2">
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
                Edit dish &amp; video
              </Button>
            )}
            <div className="ml-auto flex gap-2">{footer}</div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
