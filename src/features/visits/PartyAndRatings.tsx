import { Chip, LensIcon, RatingInput } from '@/components'
import type { DietLens, RatingValue } from '@/types'
import { FIELD_IDS, ratingFieldId } from './fieldIds'
import type { LogVisitFormValues } from './logVisitSchema'

/**
 * "Who's at the table?" picks the diets (data-driven from `lenses`), and each chosen diet gets a
 * one-tap 1-5 rating row. Adding a lens to the data adds a chip here with no code change.
 */
export function PartyAndRatings({
  lenses,
  ratings,
  onToggleLens,
  onRate,
  listError,
  ratingErrors,
}: {
  lenses: readonly DietLens[]
  ratings: LogVisitFormValues['ratings']
  onToggleLens: (lensId: string) => void
  onRate: (lensId: string, rating: RatingValue) => void
  listError?: string | undefined
  /** Per-diet "Tap a rating" messages, keyed by lens id. */
  ratingErrors: Record<string, string | undefined>
}) {
  const selected = new Set(ratings.map((r) => r.lensId))
  const rows = lenses.filter((lens) => selected.has(lens.id))

  return (
    <div className="flex flex-col gap-5">
      <fieldset id={FIELD_IDS.lenses}>
        <legend className="mb-2 text-sm font-medium">Who’s at the table?</legend>
        <div className="flex flex-wrap gap-2">
          {lenses.map((lens) => (
            <Chip
              key={lens.id}
              selected={selected.has(lens.id)}
              icon={<LensIcon icon={lens.icon} />}
              onClick={() => onToggleLens(lens.id)}
            >
              {lens.shortLabel}
            </Chip>
          ))}
        </div>
        {listError && <p className="mt-2 text-sm font-medium text-danger">{listError}</p>}
      </fieldset>

      {rows.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="font-sans text-sm font-medium">How well did it work for each?</h3>
          <ul className="flex flex-col gap-3">
            {rows.map((lens) => (
              <li key={lens.id} className="rounded-card bg-surface-sunken p-3">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <LensIcon icon={lens.icon} className="size-5 text-basil-strong" />
                  {lens.label}
                </div>
                <RatingInput
                  id={ratingFieldId(lens.id)}
                  legend={`Rating for ${lens.label}`}
                  hideLegend
                  value={ratings.find((r) => r.lensId === lens.id)?.rating}
                  onChange={(rating) => onRate(lens.id, rating)}
                  error={ratingErrors[lens.id]}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
