import { LensIcon } from '@/components'
import { formatAverage, workedTally, worthItTally, type LensStat } from '@/lib/dietFit'
import { cn } from '@/lib/cn'
import type { DietLens, Visit } from '@/types'
import { meetsFit } from '@/lib/dietFit'

/** How well each diet is served here on average, plus how often it worked for the whole group. */
export function DietBreakdown({
  lenses,
  stats,
  visits,
}: {
  lenses: readonly DietLens[]
  stats: readonly LensStat[]
  visits: readonly Visit[]
}) {
  const rows = lenses.flatMap((lens) => {
    const stat = stats.find((s) => s.lensId === lens.id)
    return stat ? [{ lens, stat }] : []
  })
  const worked = workedTally(visits)
  const worth = worthItTally(visits)

  if (visits.length === 0) {
    return <p className="text-ink-muted">No visits yet. Log one to see how each diet fared.</p>
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-col gap-4">
        {rows.map(({ lens, stat }) => (
          <li key={lens.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="flex items-center gap-2 font-semibold">
                <LensIcon icon={lens.icon} className="size-5 text-basil-strong" />
                {lens.label}
              </span>
              <span className="text-sm text-ink-muted">
                <span className="font-semibold text-ink">{formatAverage(stat.average)}</span> / 5 ·{' '}
                {stat.count} {stat.count === 1 ? 'visit' : 'visits'}
              </span>
            </div>
            <div aria-hidden className="h-2.5 overflow-hidden rounded-control bg-surface-sunken">
              <div
                className={cn('h-full rounded-control', meetsFit(stat) ? 'bg-basil' : 'bg-saffron')}
                style={{ width: `${(stat.average / 5) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 rounded-card bg-surface-sunken p-4">
        <p className="font-semibold">
          Worked for everyone in {worked.yes} of {worked.total}{' '}
          {worked.total === 1 ? 'visit' : 'visits'}
        </p>
        <p className="text-sm text-ink-muted">
          {worked.yes} yes · {worked.maybe} maybe · {worked.no} no
        </p>
        {worth.answered > 0 && (
          <p className="text-sm text-ink-muted">
            Worth the price in {worth.yes} of {worth.answered}{' '}
            {worth.answered === 1 ? 'answer' : 'answers'}
          </p>
        )}
      </div>
    </div>
  )
}
