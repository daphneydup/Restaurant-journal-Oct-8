import { Check } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Toggleable pill. Selection is shown with a check icon AND colour, never colour alone.
 */
export function Chip({
  selected = false,
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: Omit<ComponentProps<'button'>, 'aria-pressed'> & { selected?: boolean; icon?: ReactNode }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex min-h-touch items-center gap-1.5 rounded-pill border-2 px-4 text-sm font-medium transition-colors',
        selected
          ? 'border-basil bg-basil-soft text-basil-strong'
          : 'border-line-strong bg-surface text-ink hover:bg-surface-sunken',
        className,
      )}
      {...rest}
    >
      {selected ? <Check aria-hidden className="size-4" /> : icon}
      {children}
    </button>
  )
}
