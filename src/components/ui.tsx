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

export function Card({
  className,
  children,
  ...rest
}: { className?: string; children: ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cx(
        'glass min-w-0 rounded-3xl shadow-[0_18px_60px_-24px_rgba(0,0,0,0.8)]',
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
      'bg-gradient-to-br from-lime-300 to-emerald-400 text-ink-950 font-semibold hover:brightness-110 shadow-[0_10px_30px_-12px_oklch(0.86_0.19_128/0.9)]',
    soft: 'glass text-white/90 hover:bg-white/12',
    ghost: 'text-white/60 hover:text-white hover:bg-white/8',
    danger: 'bg-rose-500/15 text-rose-200 border border-rose-400/25 hover:bg-rose-500/25',
  }
  const sizes = {
    sm: 'px-3 py-1.5 text-[13px] gap-1.5 rounded-xl',
    md: 'px-4 py-2.5 text-sm gap-2 rounded-2xl',
  }
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center transition active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer',
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
        'px-3 py-1.5 rounded-full text-[13px] font-medium transition whitespace-nowrap cursor-pointer',
        active
          ? 'bg-white text-ink-950 shadow-[0_6px_20px_-8px_rgba(255,255,255,0.7)]'
          : 'glass text-white/65 hover:text-white hover:bg-white/12',
        className,
      )}
    />
  )
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full bg-white/8 px-2 py-0.5 text-[11px] tracking-wide text-white/60',
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
      <span className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em] text-white/45">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-[12px] text-white/40">{hint}</span>}
    </label>
  )
}

const inputBase =
  'w-full rounded-2xl bg-white/6 border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition focus:border-lime-300/50 focus:bg-white/10'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(inputBase, className)} />
}

export function Textarea({
  className,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputBase, 'resize-y min-h-24', className)} />
}

export function Select({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cx(inputBase, 'cursor-pointer [&>option]:bg-ink-900 [&>option]:text-white', className)}
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
        className="absolute inset-0 cursor-default bg-ink-950/80 backdrop-blur-md"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'animate-pop relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/12 bg-ink-900/97 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:rounded-3xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg',
        )}
      >
        <div className="flex items-start gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-white/50">{subtitle}</p>}
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
    <div className="flex flex-col items-center gap-2 py-14 text-center">
      <span className="text-4xl opacity-70">{emoji}</span>
      <p className="font-display text-base font-semibold text-white/80">{title}</p>
      {hint && <p className="max-w-xs text-[13px] text-white/40">{hint}</p>}
    </div>
  )
}
