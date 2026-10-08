import { useId, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'

/** Labelled text input. Error and hint text are linked with aria-describedby. */
export function TextField({
  label,
  error,
  hint,
  className,
  id,
  ...rest
}: Omit<ComponentProps<'input'>, 'aria-invalid'> & {
  label: string
  error?: string | undefined
  hint?: string
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'min-h-touch w-full rounded-md border-2 bg-surface px-3 text-base',
          error ? 'border-danger' : 'border-line-strong',
        )}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
