import { IconMonitor, IconMoon, IconSun } from '@/components/icons'
import { cx, type as t } from '@/components/ui'
import { ACCENTS, type Accent, type ThemeMode } from '@/lib/theme'

const MODES: { id: ThemeMode; label: string; Icon: typeof IconSun }[] = [
  { id: 'light', label: 'Light', Icon: IconSun },
  { id: 'dark', label: 'Dark', Icon: IconMoon },
  { id: 'system', label: 'System', Icon: IconMonitor },
]

/** Compact three-way switch. The pill slides between positions. */
export function ModeSwitch({
  mode,
  onChange,
  labels = false,
}: {
  mode: ThemeMode
  onChange: (m: ThemeMode) => void
  labels?: boolean
}) {
  const index = MODES.findIndex((m) => m.id === mode)
  return (
    <div className="relative inline-flex rounded-full border border-line bg-panel p-1 shadow-e1">
      <span
        aria-hidden
        className="absolute inset-y-1 rounded-full bg-invert shadow-e1"
        style={{
          width: `calc((100% - 0.5rem) / 3)`,
          left: `calc(0.25rem + ${index} * (100% - 0.5rem) / 3)`,
          transition: 'left 0.32s var(--ease-spring)',
        }}
      />
      {MODES.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          aria-label={`${label} theme`}
          aria-pressed={mode === id}
          title={`${label} theme`}
          className={cx(
            'relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8125rem] font-medium transition-colors duration-200',
            mode === id ? 'text-on-invert' : 'text-muted hover:text-ink',
          )}
        >
          <Icon width={15} height={15} />
          {labels && <span>{label}</span>}
        </button>
      ))}
    </div>
  )
}

/** One button that cycles light → dark → system, for tight headers. */
export function ModeToggle({
  mode,
  onChange,
}: {
  mode: ThemeMode
  onChange: (m: ThemeMode) => void
}) {
  const i = MODES.findIndex((m) => m.id === mode)
  const next = MODES[(i + 1) % MODES.length]
  const { Icon, label } = MODES[i < 0 ? 0 : i]
  return (
    <button
      onClick={() => onChange(next.id)}
      aria-label={`Theme: ${label}. Switch to ${next.label}.`}
      title={`${label} — tap for ${next.label}`}
      className="press grid size-10 cursor-pointer place-items-center rounded-xl text-muted hover:bg-fill hover:text-ink"
    >
      <Icon width={19} height={19} />
    </button>
  )
}

/** Five accent palettes, previewed as the gradient each one actually uses. */
export function AccentPicker({
  accent,
  onChange,
}: {
  accent: Accent
  onChange: (a: Accent) => void
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {ACCENTS.map(({ id, name, blurb }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={`${name} — ${blurb}`}
          aria-label={`${name} accent`}
          aria-pressed={accent === id}
          data-accent={id}
          className={cx(
            'press group flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border p-2.5',
            accent === id
              ? 'border-accent-line bg-accent-wash'
              : 'border-line bg-panel hover:border-line-strong',
          )}
        >
          <span
            className="size-7 rounded-full shadow-e1 transition-transform duration-300 group-hover:scale-110"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
          />
          <span
            className={cx(
              'text-[0.6875rem] font-medium',
              accent === id ? 'text-ink' : 'text-muted',
            )}
          >
            {name}
          </span>
        </button>
      ))}
    </div>
  )
}

export function ThemeSection({
  mode,
  accent,
  setMode,
  setAccent,
}: {
  mode: ThemeMode
  accent: Accent
  setMode: (m: ThemeMode) => void
  setAccent: (a: Accent) => void
}) {
  return (
    <div className="space-y-4">
      <div>
        <div className={cx('mb-2 text-faint', t.micro)}>Appearance</div>
        <ModeSwitch mode={mode} onChange={setMode} labels />
      </div>
      <div>
        <div className={cx('mb-2 text-faint', t.micro)}>Accent</div>
        <AccentPicker accent={accent} onChange={setAccent} />
      </div>
    </div>
  )
}
