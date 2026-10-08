import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

/** Icon-only button. `label` is required because there is no visible text. */
export function IconButton({
  label,
  className,
  children,
  type = 'button',
  ...rest
}: Omit<ComponentProps<'button'>, 'aria-label'> & { label: string }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-touch items-center justify-center rounded-pill text-ink transition-colors',
        'hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}
