import { createPortal } from 'react-dom'
import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react'
import { IconX } from '@/components/icons'

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/* ─────────────────────────── Type scale ───────────────────────────
   Material 3's scale, mapped onto the names the app already used, so a
   view asks for a role and gets size, line height, tracking and weight
   together. Sizes and weights are M3's; the faces are ours.            */

export const type = {
  displayXl: 'm3-headline-md sm:m3-headline-lg font-semibold',
  displayL: 'm3-title-lg sm:m3-headline-sm font-semibold',
  displayM: 'm3-title-lg font-semibold',
  title: 'm3-title-md',
  body: 'm3-body-md',
  small: 'm3-body-sm',
  micro: 'm3-label-md uppercase tracking-[0.09em]',
} as const

export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cx(
        /* M3 extra-large corner; cards are the one place the biggest step earns it */
        'glass min-w-0 rounded-xl transition-[background-color,border-color,box-shadow] duration-300',
        className,
      )}
    >
      {children}
    </div>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'danger'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'soft', size = 'md', className, ...rest }: ButtonProps) {
  // M3 buttons: fully rounded, label-large text, and a state layer rather than
  // a different background colour per state.
  const variants = {
    primary: 'bg-accent text-on-accent shadow-e1 hover:shadow-e2',
    soft: 'bg-panel-2 text-ink',
    ghost: 'text-accent-ink',
    danger: 'bg-danger-wash text-danger',
  }
  const sizes = {
    sm: 'h-8 px-3 gap-1.5',
    md: 'h-10 px-6 gap-2',
  }
  return (
    <button
      {...rest}
      className={cx(
        'm3-state m3-label-lg press inline-flex cursor-pointer items-center justify-center rounded-full disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
    />
  )
}

export function Chip({
  active,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={cx(
        /* M3 filter chip: 32dp tall, small corner, outlined until selected */
        'm3-state m3-label-lg press inline-flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-sm px-3',
        active
          ? 'bg-accent-wash text-accent-ink ring-1 ring-accent-line'
          : 'text-soft ring-1 ring-line',
        className,
      )}
    />
  )
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'm3-label-sm inline-flex items-center rounded-xs bg-panel-2 px-2 py-0.5 text-muted',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className={cx('mb-1.5 block text-faint', type.micro)}>{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[0.75rem] text-faint">{hint}</span>}
    </label>
  )
}

/**
 * Same look as `Field`, but a labelled group rather than a `<label>` — for
 * rows of buttons, where a wrapping label would swallow their accessible names.
 */
export function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div role="group" aria-label={label}>
      <div className={cx('mb-1.5 text-faint', type.micro)}>{label}</div>
      {children}
      {hint && <p className="mt-1.5 text-[0.75rem] text-faint">{hint}</p>}
    </div>
  )
}

const inputBase =
  'w-full rounded-2xl border border-line bg-panel px-3.5 py-2.5 text-[0.875rem] text-ink shadow-e1 outline-none transition placeholder:text-faint focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-wash)]'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputBase, className)} />
}

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputBase, 'min-h-24 resize-y', className)} />
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cx(inputBase, 'cursor-pointer [&>option]:bg-panel [&>option]:text-ink', className)}
    />
  )
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  // Portalled to <body>: the views animate a transform, which would otherwise
  // make them the containing block for this `fixed` overlay.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="animate-veil absolute inset-0 cursor-default bg-ink/35 backdrop-blur-[3px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'animate-sheet glass-strong relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[1.75rem] shadow-e4 sm:rounded-[1.75rem]',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className={type.displayM}>{title}</h2>
            {subtitle && <p className="mt-0.5 text-[0.8125rem] text-muted">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <IconX width={18} height={18} />
          </Button>
        </div>
        <div className="no-scrollbar overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

export function Empty({ emoji, title, hint }: { emoji: string; title: string; hint?: string }) {
  return (
    <div className="animate-rise flex flex-col items-center gap-2 py-14 text-center">
      <span className="animate-float text-4xl opacity-80">{emoji}</span>
      <p className={cx(type.displayM, 'text-soft')}>{title}</p>
      {hint && <p className="max-w-xs text-[0.8125rem] text-faint">{hint}</p>}
    </div>
  )
}
