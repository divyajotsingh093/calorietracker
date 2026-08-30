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
   Six steps, each with its own tracking. Display sizes tighten as they
   grow; the micro step is the only one that gets letterspaced out.      */

export const type = {
  displayXl: 'font-display text-[2rem] sm:text-[2.5rem] font-semibold leading-[1.05]',
  displayL: 'font-display text-[1.5rem] sm:text-[1.75rem] font-semibold leading-[1.12]',
  displayM: 'font-display text-[1.125rem] font-semibold leading-[1.2]',
  title: 'text-[0.9375rem] font-semibold leading-[1.35]',
  body: 'text-[0.875rem] leading-[1.55]',
  small: 'text-[0.8125rem] leading-[1.45]',
  micro: 'text-[0.6875rem] font-medium uppercase tracking-[0.09em]',
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
        'glass min-w-0 rounded-[1.5rem] transition-[background-color,border-color,box-shadow] duration-300',
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
  const variants = {
    primary:
      'bg-gradient-to-br from-accent to-accent-2 text-on-accent font-semibold shadow-e2 hover:brightness-[1.07] hover:shadow-e3',
    soft: 'bg-panel border border-line text-soft shadow-e1 hover:bg-panel-2 hover:text-ink hover:shadow-e2',
    ghost: 'text-muted hover:bg-fill hover:text-ink',
    danger: 'bg-danger-wash text-danger border border-danger/25 hover:bg-danger hover:text-on-accent',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-[0.8125rem] gap-1.5 rounded-xl',
    md: 'px-4 py-2.5 text-[0.875rem] gap-2 rounded-2xl',
  }
  return (
    <button
      {...rest}
      className={cx(
        'press inline-flex cursor-pointer items-center justify-center font-medium disabled:pointer-events-none disabled:opacity-40',
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
        'press cursor-pointer whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium',
        active
          ? 'bg-invert text-on-invert shadow-e2'
          : 'border border-line bg-panel text-muted hover:border-line-strong hover:text-ink',
        className,
      )}
    />
  )
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full bg-fill px-2 py-0.5 text-[0.6875rem] font-medium tracking-[0.01em] text-muted',
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
