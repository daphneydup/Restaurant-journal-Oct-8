import { Star } from 'lucide-react'
import { useId } from 'react'
import { RATING_WORDS } from '@/lib/format'
import { cn } from '@/lib/cn'
import { RATING_VALUES, type RatingValue } from '@/types'

/**
 * 1 to 5 star rating built on native radios: arrow keys, grouping and form semantics for free.
 * Every star is a 44px target, and the chosen value is also written out ("Great, 5 of 5"),
 * so meaning never depends on colour.
 */
export function RatingInput({
  legend,
  value,
  onChange,
  error,
  id,
  hideLegend = false,
}: {
  legend: string
  value: RatingValue | undefined
  onChange: (value: RatingValue) => void
  error?: string | undefined
  id?: string
  /** Keep the legend for screen readers but hide it when a visible heading already says it. */
  hideLegend?: boolean
}) {
  const name = useId()
  const errorId = `${name}-error`
  return (
    <fieldset
      id={id}
      aria-describedby={error ? errorId : undefined}
      tabIndex={-1}
      className="outline-none"
    >
      <legend className={cn('mb-1 text-sm font-medium', hideLegend && 'sr-only')}>{legend}</legend>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-0">
        {RATING_VALUES.map((n) => (
          <label key={n} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              aria-label={`${n} of 5, ${RATING_WORDS[n]}`}
              className="peer sr-only"
            />
            <span
              className={cn(
                'flex size-touch items-center justify-center rounded-pill transition-colors',
                'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-focus',
              )}
            >
              <Star
                aria-hidden
                className={cn(
                  'size-7 stroke-ink-muted',
                  value !== undefined && n <= value ? 'fill-saffron' : 'fill-transparent',
                )}
              />
            </span>
          </label>
        ))}
        {error ? (
          <span id={errorId} className="ml-2 text-sm font-medium text-danger">
            {error}
          </span>
        ) : (
          <span aria-hidden className="ml-2 text-sm font-semibold text-ink-muted">
            {value ? `${RATING_WORDS[value]} · ${value}/5` : 'Tap to rate'}
          </span>
        )}
      </div>
    </fieldset>
  )
}
