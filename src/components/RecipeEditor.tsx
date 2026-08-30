import { useState } from 'react'
import { IconPlus, IconTrash } from '@/components/icons'
import { Button, Field, Input, Modal, Select, Textarea, cx } from '@/components/ui'
import { AISLE_ORDER } from '@/lib/grocery'
import { SLOTS, SLOT_META } from '@/lib/slots'
import { uid } from '@/lib/store'
import type { Aisle, Ingredient, Recipe } from '@/types'

const EMOJIS = ['🥗', '🍲', '🍛', '🍝', '🍜', '🥘', '🍳', '🥞', '🌯', '🌮', '🍣', '🐟', '🍗', '🥩', '🍚', '🥪', '🫐', '🥑', '🍅', '🍄', '🧆', '🥕', '🍫', '🍯']

const EMPTY: Recipe = {
  id: '',
  name: '',
  emoji: '🥗',
  slots: ['dinner'],
  calories: 500,
  protein: 30,
  carbs: 50,
  fat: 18,
  minutes: 25,
  servings: 2,
  tags: [],
  ingredients: [{ item: '', qty: 1, unit: 'g', aisle: 'Produce' }],
  steps: [''],
  link: '',
  linkLabel: '',
  custom: true,
}

export function RecipeEditor({
  open,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  initial: Recipe | null
  onClose: () => void
  onSave: (r: Recipe) => void
  onDelete?: (id: string) => void
}) {
  const [draft, setDraft] = useState<Recipe>(initial ?? EMPTY)
  const [error, setError] = useState('')

  const set = <K extends keyof Recipe>(k: K, v: Recipe[K]) =>
    setDraft((d) => ({ ...d, [k]: v }))

  const setIngredient = (i: number, patch: Partial<Ingredient>) =>
    setDraft((d) => ({
      ...d,
      ingredients: d.ingredients.map((ing, idx) => (idx === i ? { ...ing, ...patch } : ing)),
    }))

  const submit = () => {
    if (!draft.name.trim()) return setError('Give the dish a name.')
    if (!draft.slots.length) return setError('Pick at least one meal slot.')
    const cleaned: Recipe = {
      ...draft,
      id: draft.id || `r-${uid()}`,
      name: draft.name.trim(),
      custom: draft.custom ?? !initial?.id.startsWith('r-'),
      ingredients: draft.ingredients
        .filter((i) => i.item.trim())
        .map((i) => ({ ...i, item: i.item.trim().toLowerCase() })),
      steps: draft.steps.map((s) => s.trim()).filter(Boolean),
      tags: draft.tags.map((t) => t.trim().toLowerCase()).filter(Boolean),
      link: draft.link?.trim() || undefined,
      linkLabel: draft.link?.trim() ? draft.linkLabel?.trim() || 'Open recipe' : undefined,
    }
    onSave(cleaned)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={initial?.id ? 'Edit dish' : 'New dish'}
      subtitle="Nutrition is per serving. Ingredient amounts are for the whole batch."
    >
      <div className="space-y-5">
        {error && (
          <p className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-200">
            {error}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <Field label="Icon">
            <div className="glass grid max-h-24 w-full grid-cols-8 gap-1 overflow-y-auto rounded-2xl p-2 sm:w-56">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => set('emoji', e)}
                  className={cx(
                    'grid aspect-square place-items-center rounded-lg text-lg transition cursor-pointer',
                    draft.emoji === e ? 'bg-white text-ink-950' : 'hover:bg-white/12',
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </Field>
          <div className="space-y-4">
            <Field label="Dish name">
              <Input
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Miso glazed aubergine"
              />
            </Field>
            <Field label="Meal slots">
              <div className="flex flex-wrap gap-2">
                {SLOTS.map((s) => {
                  const on = draft.slots.includes(s)
                  return (
                    <button
                      key={s}
                      onClick={() =>
                        set(
                          'slots',
                          on ? draft.slots.filter((x) => x !== s) : [...draft.slots, s],
                        )
                      }
                      className={cx(
                        'rounded-full px-3 py-1.5 text-[13px] transition cursor-pointer',
                        on ? 'bg-white text-ink-950 font-medium' : 'glass text-white/60',
                      )}
                    >
                      {SLOT_META[s].emoji} {SLOT_META[s].label}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {(
            [
              ['calories', 'Calories', 'kcal'],
              ['protein', 'Protein', 'g'],
              ['carbs', 'Carbs', 'g'],
              ['fat', 'Fat', 'g'],
              ['minutes', 'Time', 'min'],
              ['servings', 'Servings', ''],
            ] as const
          ).map(([key, label, unit]) => (
            <Field key={key} label={`${label}${unit ? ` (${unit})` : ''}`}>
              <Input
                type="number"
                min={0}
                value={draft[key]}
                onChange={(e) => set(key, Math.max(0, Number(e.target.value)) as never)}
              />
            </Field>
          ))}
        </div>

        <Field label="Tags" hint="Comma separated — used by search and filters.">
          <Input
            value={draft.tags.join(', ')}
            onChange={(e) => set('tags', e.target.value.split(',').map((t) => t.trim()))}
            placeholder="quick, vegetarian, meal-prep"
          />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/45">
              Ingredients
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                set('ingredients', [
                  ...draft.ingredients,
                  { item: '', qty: 1, unit: 'g', aisle: 'Produce' },
                ])
              }
            >
              <IconPlus width={15} height={15} /> Add row
            </Button>
          </div>
          <div className="space-y-2">
            {draft.ingredients.map((ing, i) => (
              <div key={i} className="grid grid-cols-[1fr_4.5rem_4.5rem_auto] gap-2 sm:grid-cols-[1fr_5rem_5rem_9rem_auto]">
                <Input
                  value={ing.item}
                  onChange={(e) => setIngredient(i, { item: e.target.value })}
                  placeholder="ingredient"
                />
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={ing.qty}
                  onChange={(e) => setIngredient(i, { qty: Number(e.target.value) })}
                />
                <Input
                  value={ing.unit}
                  onChange={(e) => setIngredient(i, { unit: e.target.value })}
                  placeholder="g"
                />
                <Select
                  className="col-span-3 sm:col-span-1"
                  value={ing.aisle}
                  onChange={(e) => setIngredient(i, { aisle: e.target.value as Aisle })}
                >
                  {AISLE_ORDER.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Remove ingredient"
                  onClick={() =>
                    set(
                      'ingredients',
                      draft.ingredients.filter((_, idx) => idx !== i),
                    )
                  }
                >
                  <IconTrash width={15} height={15} />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Field label="Method" hint="One step per line.">
          <Textarea
            value={draft.steps.join('\n')}
            onChange={(e) => set('steps', e.target.value.split('\n'))}
            placeholder={'Heat the oven to 200°C.\nToss everything in oil and roast 25 minutes.'}
            rows={5}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <Field label="Recipe link">
            <Input
              value={draft.link ?? ''}
              onChange={(e) => set('link', e.target.value)}
              placeholder="https://…"
            />
          </Field>
          <Field label="Link label">
            <Input
              value={draft.linkLabel ?? ''}
              onChange={(e) => set('linkLabel', e.target.value)}
              placeholder="BBC Good Food"
            />
          </Field>
        </div>

        <div className="flex items-center gap-2 border-t border-white/10 pt-4">
          {initial?.id && onDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onDelete(initial.id)
                onClose()
              }}
            >
              <IconTrash width={15} height={15} /> Delete
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit}>
              Save dish
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
