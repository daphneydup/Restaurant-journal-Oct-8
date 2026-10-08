import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmDialog, IconButton, PriceTierBadge, WorkedBadge, useToast } from '@/components'
import { useDeleteVisit } from '@/hooks/queries'
import { formatVisitDate } from '@/lib/format'
import { daysSince, formatSince } from '@/lib/relativeTime'
import type { DietLens, Visit } from '@/types'

export function VisitHistory({
  visits,
  lenses,
  now,
}: {
  visits: readonly Visit[]
  lenses: readonly DietLens[]
  now: Date
}) {
  const { showToast } = useToast()
  const deleteVisit = useDeleteVisit()
  const [pending, setPending] = useState<Visit | null>(null)

  if (visits.length === 0) {
    return <p className="text-ink-muted">No visits logged yet.</p>
  }

  function confirmDelete() {
    if (!pending) return
    deleteVisit.mutate(pending.id, {
      onSuccess: () => {
        showToast('Visit deleted')
        setPending(null)
      },
      onError: () => {
        showToast('We couldn’t delete that visit. Please try again.', { tone: 'error' })
      },
    })
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {visits.map((visit) => (
          <li key={visit.id} className="rounded-card border border-line p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-sans text-base font-semibold">{formatVisitDate(visit.date)}</h3>
                <p className="text-sm text-ink-muted">
                  {formatSince(daysSince(visit.date, now))} ·{' '}
                  <PriceTierBadge tier={visit.priceTier} />
                  {visit.worthIt !== undefined &&
                    ` · ${visit.worthIt ? 'Worth it' : 'Not really worth it'}`}
                </p>
              </div>
              <IconButton
                label={`Delete visit from ${formatVisitDate(visit.date)}`}
                onClick={() => setPending(visit)}
              >
                <Trash2 aria-hidden className="size-4" />
              </IconButton>
            </div>

            <WorkedBadge value={visit.workedForEveryone} className="mt-2" />

            <ul aria-label="Ratings" className="mt-2 flex flex-wrap gap-2 text-sm">
              {visit.ratings.map(({ lensId, rating }) => (
                <li key={lensId} className="rounded-pill bg-surface-sunken px-2.5 py-1 font-medium">
                  {lenses.find((l) => l.id === lensId)?.shortLabel ?? lensId} {rating}/5
                </li>
              ))}
            </ul>

            {visit.companions.length > 0 && (
              <p className="mt-2 text-sm text-ink-muted">With {visit.companions.join(', ')}</p>
            )}
            {visit.note && (
              <p className="mt-2 border-l-4 border-saffron pl-3 italic">{visit.note}</p>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pending !== null}
        title="Delete this visit?"
        confirmLabel="Delete visit"
        busy={deleteVisit.isPending}
        onCancel={() => setPending(null)}
        onConfirm={confirmDelete}
      >
        <p>
          {pending
            ? `The visit on ${formatVisitDate(pending.date)} and the dishes saved with it`
            : ''}{' '}
          will be removed. This can’t be undone.
        </p>
      </ConfirmDialog>
    </>
  )
}
