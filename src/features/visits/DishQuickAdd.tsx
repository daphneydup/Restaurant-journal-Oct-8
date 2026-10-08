import { ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { Button, Chip, IconButton, LensIcon } from '@/components'
import type { DietLens, DishVerdict } from '@/types'
import type { LogVisitFormValues } from './logVisitSchema'

type DishDraft = LogVisitFormValues['dishes'][number]

/**
 * Type a dish, then tap "Order again" or "Skip". Enter counts as "Order again", the common
 * case. Optionally mark which diets a dish suits. Added dishes appear as a removable list.
 */
export function DishQuickAdd({
  dishes,
  onChange,
  lenses,
  max,
}: {
  dishes: DishDraft[]
  onChange: (dishes: DishDraft[]) => void
  /** Only the diets currently at the table. */
  lenses: readonly DietLens[]
  max: number
}) {
  const inputId = useId()
  const [name, setName] = useState('')
  const [lensIds, setLensIds] = useState<string[]>([])
  const [hint, setHint] = useState<string | null>(null)
  const full = dishes.length >= max

  function add(verdict: DishVerdict) {
    const trimmed = name.trim()
    if (!trimmed) {
      setHint('Type a dish name first.')
      return
    }
    onChange([
      ...dishes,
      { name: trimmed, verdict, lensIds: lensIds.filter((id) => lenses.some((l) => l.id === id)) },
    ])
    setName('')
    setLensIds([])
    setHint(null)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault() // never submit the whole form from here
      add('order-again')
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium">
          Dishes to remember
        </label>
        <input
          id={inputId}
          value={name}
          maxLength={60}
          disabled={full}
          autoComplete="off"
          placeholder={full ? 'Dish limit reached' : 'e.g. Charred cauliflower'}
          aria-describedby={hint ? `${inputId}-hint` : undefined}
          onChange={(event) => {
            setName(event.target.value)
            setHint(null)
          }}
          onKeyDown={onKeyDown}
          className="min-h-touch w-full rounded-md border-2 border-line-strong bg-surface px-3 text-base"
        />
        {hint && (
          <p id={`${inputId}-hint`} role="alert" className="mt-1 text-sm font-medium text-danger">
            {hint}
          </p>
        )}
      </div>

      {lenses.length > 0 && (
        <div
          role="group"
          aria-label="This dish works for"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="text-sm text-ink-muted">Works for:</span>
          {lenses.map((lens) => (
            <Chip
              key={lens.id}
              selected={lensIds.includes(lens.id)}
              icon={<LensIcon icon={lens.icon} />}
              onClick={() =>
                setLensIds((current) =>
                  current.includes(lens.id)
                    ? current.filter((id) => id !== lens.id)
                    : [...current, lens.id],
                )
              }
            >
              {lens.shortLabel}
            </Chip>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={full} onClick={() => add('order-again')}>
          <ThumbsUp aria-hidden className="size-4" /> Order again
        </Button>
        <Button variant="secondary" disabled={full} onClick={() => add('skip')}>
          <ThumbsDown aria-hidden className="size-4" /> Skip
        </Button>
      </div>

      {dishes.length > 0 && (
        <ul aria-label="Dishes you added" className="flex flex-col gap-2">
          {dishes.map((dish, index) => (
            <li
              key={`${dish.name}-${index}`}
              className="flex items-center justify-between gap-2 rounded-md bg-surface-sunken py-1 pr-1 pl-3"
            >
              <span className="flex min-w-0 items-center gap-2">
                {dish.verdict === 'order-again' ? (
                  <ThumbsUp aria-hidden className="size-4 shrink-0 text-basil-strong" />
                ) : (
                  <ThumbsDown aria-hidden className="size-4 shrink-0 text-danger" />
                )}
                <span className="truncate font-medium">{dish.name}</span>
                <span className="text-sm text-ink-muted">
                  {dish.verdict === 'order-again' ? 'Order again' : 'Skip'}
                </span>
              </span>
              <IconButton
                label={`Remove ${dish.name}`}
                onClick={() => onChange(dishes.filter((_, i) => i !== index))}
              >
                <X aria-hidden className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
