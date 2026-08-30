import { cx } from '@/components/ui'
import { dietLabel } from '@/lib/profiles'
import type { Profile } from '@/types'

export function Avatar({
  profile,
  size = 'md',
  ring,
}: {
  profile: Profile
  size?: 'xs' | 'sm' | 'md'
  ring?: boolean
}) {
  const sizes = { xs: 'size-4 text-[9px]', sm: 'size-6 text-[11px]', md: 'size-9 text-base' }
  return (
    <span
      title={`${profile.name} — ${dietLabel(profile.diet)}`}
      className={cx(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-ink-950',
        profile.accent,
        sizes[size],
        ring && 'ring-2 ring-ink-950',
      )}
    >
      {profile.emoji}
    </span>
  )
}

/** Overlapping avatars for a meal that more than one person is eating. */
export function AvatarStack({
  profiles,
  size = 'xs',
}: {
  profiles: Profile[]
  size?: 'xs' | 'sm'
}) {
  if (!profiles.length) return null
  return (
    <span className="flex -space-x-1">
      {profiles.map((p) => (
        <Avatar key={p.id} profile={p} size={size} ring />
      ))}
    </span>
  )
}

/** Ruchi | Dj | Both switcher. */
export function ScopeSwitcher({
  profiles,
  scope,
  onChange,
  className,
}: {
  profiles: Profile[]
  scope: string
  onChange: (scope: string) => void
  className?: string
}) {
  return (
    <div className={cx('glass flex items-center gap-1 rounded-full p-1', className)}>
      {profiles.map((p) => (
        <button
          key={p.id}
          onClick={() => onChange(p.id)}
          className={cx(
            'flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-[13px] font-medium transition cursor-pointer',
            scope === p.id
              ? 'bg-white text-ink-950'
              : 'text-white/55 hover:bg-white/10 hover:text-white',
          )}
        >
          <Avatar profile={p} size="sm" />
          {p.name}
        </button>
      ))}
      <button
        onClick={() => onChange('both')}
        className={cx(
          'rounded-full px-3 py-1.5 text-[13px] font-medium transition cursor-pointer',
          scope === 'both'
            ? 'bg-white text-ink-950'
            : 'text-white/55 hover:bg-white/10 hover:text-white',
        )}
      >
        Both
      </button>
    </div>
  )
}
