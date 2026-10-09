import { Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps } from 'react'
import { cn } from '@/lib/cn'

/** Labelled password input with a show/hide button, so typos on a phone keyboard are catchable. */
export function PasswordField({
  label,
  error,
  hint,
  className,
  id,
  ...rest
}: Omit<ComponentProps<'input'>, 'type' | 'aria-invalid'> & {
  label: string
  error?: string | undefined
  hint?: string
}) {
  const autoId = useId()
  const inputId = id ?? autoId
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined
  const [visible, setVisible] = useState(false)

  return (
    <div className={className}>
      <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            'min-h-touch w-full rounded-md border-2 bg-surface pr-14 pl-3 text-base',
            error ? 'border-danger' : 'border-line-strong',
          )}
          {...rest}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={`Show ${label.toLowerCase()}`}
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-1 flex size-touch -translate-y-1/2 items-center justify-center rounded-pill hover:bg-surface-sunken"
        >
          {visible ? (
            <EyeOff aria-hidden className="size-5" />
          ) : (
            <Eye aria-hidden className="size-5" />
          )}
        </button>
      </div>
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
