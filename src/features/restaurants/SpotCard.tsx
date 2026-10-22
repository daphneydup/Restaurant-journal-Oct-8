import { Bookmark } from 'lucide-react'
import { Link } from 'react-router'
import { DietFitBadge, PriceTierBadge } from '@/components'
import { daysSince, formatSince } from '@/lib/relativeTime'
import type { DietLens } from '@/types'
import type { Spot } from './spots'

/** One restaurant in the My Spots list. The whole card is a single link to its detail page. */
export function SpotCard({
  spot,
  lenses,
  now,
}: {
  spot: Spot
  /** All lenses, in display order. */
  lenses: readonly DietLens[]
  now: Date
}) {
  const { restaurant, stats, visits, lastVisitDate, goBack } = spot
  const badges = lenses.flatMap((lens) => {
    const stat = stats.find((s) => s.lensId === lens.id)
    return stat ? [{ lens, average: stat.average }] : []
  })

  return (
    <li className="relative rounded-card bg-surface p-4 shadow-card transition-shadow hover:shadow-raised has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg">
            <Link
              to={`/spots/${restaurant.id}`}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              {restaurant.name}
            </Link>
          </h2>
          <p className="text-sm text-ink-muted">
            {restaurant.neighborhood} · <PriceTierBadge tier={restaurant.priceTier} />
            {restaurant.cuisine && ` · ${restaurant.cuisine}`}
          </p>
        </div>
        {goBack && (
          <span className="flex shrink-0 items-center gap-1 rounded-control bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-strong">
            <Bookmark aria-hidden className="size-3.5" /> Go back
          </span>
        )}
      </div>

      {badges.length > 0 ? (
        <ul aria-label="Diet fit" className="mt-3 flex flex-wrap gap-2">
          {badges.map(({ lens, average }) => (
            <li key={lens.id}>
              <DietFitBadge lens={lens} average={average} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">No diet ratings yet</p>
      )}

      <p className="mt-3 text-sm text-ink-muted">
        {lastVisitDate
          ? `Last visited ${formatSince(daysSince(lastVisitDate, now))} · ${visits.length} ${visits.length === 1 ? 'visit' : 'visits'}`
          : 'Not visited yet'}
      </p>
    </li>
  )
}
