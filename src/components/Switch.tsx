import { useId, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'

/** Native checkbox with role="switch": keyboard and screen-reader support come for free. */
export function Switch({
  label,
  description,
  className,
  id,
  ...rest
}: Omit<ComponentProps<'input'>, 'type' | 'role'> & { label: string; description?: string }) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex min-h-touch cursor-pointer items-center justify-between gap-4',
        className,
      )}
    >
      <span>
        <span className="block font-medium">{label}</span>
        {description && <span className="block text-sm text-ink-muted">{description}</span>}
      </span>
      <input id={inputId} type="checkbox" role="switch" className="peer sr-only" {...rest} />
      <span
        aria-hidden
        className={cn(
          'relative h-8 w-14 shrink-0 rounded-pill border-2 border-line-strong bg-surface-sunken transition-colors',
          'peer-checked:border-basil peer-checked:bg-basil peer-disabled:opacity-50',
          'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
          'after:absolute after:top-0.5 after:left-0.5 after:size-6 after:rounded-pill after:bg-white after:shadow-card after:transition-transform',
          'after:border after:border-line-strong peer-checked:after:translate-x-6',
        )}
      />
    </label>
  )
}
