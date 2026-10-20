import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'md' | 'lg'

const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold tracking-[0.14em] uppercase transition-colors ' +
  'disabled:cursor-not-allowed disabled:opacity-50 select-none'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-primary/60 bg-transparent text-primary-strong hover:bg-primary-soft',
  ghost: 'text-primary-strong hover:bg-primary-soft',
  danger: 'bg-danger-solid text-white hover:bg-danger-solid-hover',
}

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-touch px-5 text-xs',
  lg: 'min-h-12 px-6 text-sm',
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
