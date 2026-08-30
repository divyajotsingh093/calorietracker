import { useMemo, useState } from 'react'
import { IconCheck, IconCopy, IconPlus, IconPrint, IconTrash } from '@/components/icons'
import { ScopeSwitcher } from '@/components/ProfileBits'
import { Button, Card, Chip, Empty, Input, cx, type as t } from '@/components/ui'
import { rangeLabel } from '@/lib/date'
import { tintStyle } from '@/lib/slots'
import {
  AISLE_META,
  amountsLabel,
  buildGroceryList,
  groupByAisle,
  listToText,
} from '@/lib/grocery'
import { useStore } from '@/lib/store'

export function Grocery() {
  const { state, days, recipeMap, scoped, setScope, toggleChecked, clearChecked, addExtra, removeExtra } =
    useStore()
  const [week, setWeek] = useState<0 | 1>(0)
  const [newItem, setNewItem] = useState('')
  const [copied, setCopied] = useState(false)

  const weekDays = days.slice(week * 7, week * 7 + 7)
  const scopedPlan = useMemo(
    () => state.plan.filter((e) => scoped.some((p) => p.id === e.profileId)),
    [state.plan, scoped],
  )
  const lines = useMemo(
    () => buildGroceryList(weekDays, scopedPlan, recipeMap),
    [weekDays, scopedPlan, recipeMap],
  )
  const groups = groupByAisle(lines)
  const extras = state.extras.filter((e) => e.week === week)

  const doneCount =
    lines.filter((l) => state.checked.includes(`${week}|${l.key}`)).length +
    extras.filter((e) => state.checked.includes(`${week}|x:${e.id}`)).length
  const totalCount = lines.length + extras.length
  const pct = totalCount ? (doneCount / totalCount) * 100 : 0

  const dishCount = new Set(
    scopedPlan.filter((e) => weekDays.includes(e.date)).map((e) => e.recipeId),
  ).size

  const copy = async () => {
    const text = listToText(
      lines,
      `Grocery list · Week ${week + 1} (${rangeLabel(weekDays[0], 7)})`,
      extras.map((e) => e.text),
    )
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      window.prompt('Copy your list:', text)
    }
  }

  return (
    <div className="animate-rise space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={t.displayXl}>
            Grocery list
          </h1>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {scoped.length > 1 ? 'Both plans' : `${scoped[0]?.name}'s plan`} for{' '}
            {rangeLabel(weekDays[0], 7)} · {dishCount} dishes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="soft" onClick={copy}>
            <IconCopy width={15} height={15} /> {copied ? 'Copied!' : 'Copy list'}
          </Button>
          <Button size="sm" variant="soft" onClick={() => window.print()}>
            <IconPrint width={15} height={15} /> Print
          </Button>
          <Button size="sm" variant="ghost" onClick={() => clearChecked(week)}>
            Uncheck all
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <ScopeSwitcher profiles={state.profiles} scope={state.scope} onChange={setScope} />
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 print:hidden">
        <Chip active={week === 0} onClick={() => setWeek(0)}>
          Week 1 · {rangeLabel(days[0], 7)}
        </Chip>
        <Chip active={week === 1} onClick={() => setWeek(1)}>
          Week 2 · {rangeLabel(days[7], 7)}
        </Chip>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className={cx(t.micro, 'text-faint')}>
            {doneCount} of {totalCount} in the basket
          </span>
          <span className="text-[13px] tabular-nums text-faint">{Math.round(pct)}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-fill">
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </Card>

      {totalCount === 0 ? (
        <Empty
          emoji="🛒"
          title="Nothing to buy for this week"
          hint="Add some meals to the planner and the list fills itself in."
        />
      ) : (
        <div className="stagger grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {groups.map(([aisle, items], i) => (
            <Card
              key={aisle}
              className="wash p-4"
              style={{ ...tintStyle(AISLE_META[aisle].tint), '--i': i } as React.CSSProperties}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span className="text-lg">{AISLE_META[aisle].emoji}</span>
                <h2 className={cx(t.micro, 'text-faint')}>
                  {aisle}
                </h2>
                <span className="ml-auto text-[12px] tabular-nums text-faint">
                  {items.length}
                </span>
              </div>
              <ul className="space-y-1.5">
                {items.map((line) => {
                  const key = `${week}|${line.key}`
                  const done = state.checked.includes(key)
                  return (
                    <li key={key}>
                      <button
                        onClick={() => toggleChecked(key)}
                        className={cx(
                          'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition cursor-pointer',
                          done ? 'opacity-45' : 'hover:bg-fill',
                        )}
                      >
                        <span
                          className={cx(
                            'grid size-5 shrink-0 place-items-center rounded-md border transition',
                            done
                              ? 'border-accent bg-accent text-on-accent'
                              : 'border-line-strong text-transparent',
                          )}
                        >
                          <IconCheck width={13} height={13} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cx(
                              'block truncate text-sm first-letter:uppercase',
                              done && 'line-through decoration-faint',
                            )}
                          >
                            {line.item}
                          </span>
                          <span className="block truncate text-[0.6875rem] text-faint">
                            for {line.from.join(', ')}
                          </span>
                        </span>
                        <span className="shrink-0 text-[13px] tabular-nums text-muted">
                          {amountsLabel(line.amounts)}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))}

          <Card className="wash p-4" style={tintStyle('var(--ink-faint)')}>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="text-lg">🧺</span>
              <h2 className={cx(t.micro, 'text-faint')}>
                Extras
              </h2>
              <span className="ml-auto text-[12px] tabular-nums text-faint">
                {extras.length}
              </span>
            </div>
            <ul className="mb-3 space-y-1.5">
              {extras.map((e) => {
                const key = `${week}|x:${e.id}`
                const done = state.checked.includes(key)
                return (
                  <li key={e.id} className="group flex items-center gap-2">
                    <button
                      onClick={() => toggleChecked(key)}
                      className={cx(
                        'flex flex-1 items-center gap-3 rounded-xl px-2.5 py-2 text-left transition cursor-pointer',
                        done ? 'opacity-45' : 'hover:bg-fill',
                      )}
                    >
                      <span
                        className={cx(
                          'grid size-5 shrink-0 place-items-center rounded-md border transition',
                          done
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-line-strong text-transparent',
                        )}
                      >
                        <IconCheck width={13} height={13} />
                      </span>
                      <span className={cx('text-sm', done && 'line-through decoration-faint')}>
                        {e.text}
                      </span>
                    </button>
                    <button
                      aria-label="Remove"
                      onClick={() => removeExtra(e.id)}
                      className="grid size-7 shrink-0 place-items-center rounded-lg text-faint opacity-0 transition hover:bg-danger-wash hover:text-danger group-hover:opacity-100 cursor-pointer"
                    >
                      <IconTrash width={14} height={14} />
                    </button>
                  </li>
                )
              })}
              {!extras.length && (
                <li className="px-2.5 py-2 text-[0.8125rem] text-faint">
                  Coffee, washing-up liquid, whatever else.
                </li>
              )}
            </ul>
            <form
              className="flex gap-2 print:hidden"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newItem.trim()) return
                addExtra(week, newItem.trim())
                setNewItem('')
              }}
            >
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Add an item…"
              />
              <Button variant="soft" type="submit" aria-label="Add item">
                <IconPlus width={16} height={16} />
              </Button>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}
