import { useId } from 'react'
import { cn } from '@/lib/cn'

export type SegmentedOption<T extends string> = { value: T; label: string }

/** Single-choice control built on native radios (arrow keys and grouping for free). */
export function SegmentedControl<T extends string>({
  legend,
  options,
  value,
  onChange,
  hideLegend = false,
}: {
  legend: string
  options: readonly SegmentedOption<T>[]
  value: T | undefined
  onChange: (value: T) => void
  hideLegend?: boolean
}) {
  const name = useId()
  return (
    <fieldset>
      <legend className={cn('mb-2 text-sm font-medium', hideLegend && 'sr-only')}>{legend}</legend>
      <div className="inline-flex w-full rounded-pill bg-surface-sunken p-1">
        {options.map((option) => (
          <label key={option.value} className="flex-1">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'flex min-h-touch cursor-pointer items-center justify-center rounded-pill px-3 text-sm font-semibold transition-colors',
                'peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-card',
                'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
              )}
            >
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
