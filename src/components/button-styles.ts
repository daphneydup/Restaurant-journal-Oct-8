import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-pill font-semibold transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-50 select-none'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border-2 border-line-strong bg-surface text-ink hover:bg-surface-sunken',
  ghost: 'text-primary-strong hover:bg-primary-soft',
  danger: 'bg-danger text-white hover:bg-danger-hover',
}

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-touch px-5 text-sm',
  lg: 'min-h-12 px-6 text-base',
}

export function buttonStyles({
  variant = 'primary',
  size = 'md',
  className,
}: {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
} = {}) {
  return cn(base, variants[variant], sizes[size], className)
}
