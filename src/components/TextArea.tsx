import { useId, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'

/** Labelled textarea with an optional live character count. */
export function TextArea({
  label,
  error,
  hint,
  maxLength,
  value,
  className,
  id,
  ...rest
}: Omit<ComponentProps<'textarea'>, 'aria-invalid'> & {
  label: string
  error?: string | undefined
  hint?: string
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined
  const length = typeof value === 'string' ? value.length : 0

  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        {maxLength !== undefined && (
          <span aria-hidden className="text-xs text-ink-muted">
            {length}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        id={inputId}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'min-h-24 w-full rounded-md border-2 bg-surface px-3 py-2 text-base',
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
