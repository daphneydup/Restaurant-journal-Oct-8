import { daysSince } from '@/lib/relativeTime'
import type { GoBackEntry, Restaurant } from '@/types'
import type { Spot } from '@/features/restaurants/spots'

export interface GoBackItem {
  spot: Spot
  restaurant: Restaurant
  entry: GoBackEntry
  /** Days since the last visit, or null if never visited. */
  daysSinceVisit: number | null
  daysSinceSaved: number
  /** What the list is sorted by: time since the visit, else time since it was saved. */
  waiting: number
}

/**
 * Spots flagged to revisit, longest wait first. A spot you've never been to waits from the day
 * you saved it. Ties fall back to the name so the order is stable.
 */
export function buildGoBackList(spots: readonly Spot[], now: Date): GoBackItem[] {
  const items: GoBackItem[] = []
  for (const spot of spots) {
    if (!spot.goBack) continue
    const daysSinceVisit = spot.lastVisitDate ? daysSince(spot.lastVisitDate, now) : null
    const daysSinceSaved = daysSince(spot.goBack.addedAt, now)
    items.push({
      spot,
      restaurant: spot.restaurant,
      entry: spot.goBack,
      daysSinceVisit,
      daysSinceSaved,
      waiting: daysSinceVisit ?? daysSinceSaved,
    })
  }
  return items.sort(
    (a, b) => b.waiting - a.waiting || a.restaurant.name.localeCompare(b.restaurant.name),
  )
}
