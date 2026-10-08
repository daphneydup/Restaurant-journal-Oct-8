import { latestVisitDate, lensStats, meetsFit, type LensStat } from '@/lib/dietFit'
import { PRICE_TIERS, type GoBackEntry, type PriceTier, type Restaurant, type Visit } from '@/types'

/** A restaurant plus everything derived from the user's own history there. */
export interface Spot {
  restaurant: Restaurant
  /** Newest first. */
  visits: Visit[]
  stats: LensStat[]
  /** `YYYY-MM-DD` of the latest visit, or null if never visited. */
  lastVisitDate: string | null
  goBack: GoBackEntry | null
}

export function buildSpots(
  restaurants: readonly Restaurant[],
  visits: readonly Visit[],
  goBackEntries: readonly GoBackEntry[],
): Spot[] {
  return restaurants.map((restaurant) => {
    const own = visits
      .filter((v) => v.restaurantId === restaurant.id)
      .sort((a, b) => b.date.localeCompare(a.date))
    return {
      restaurant,
      visits: own,
      stats: lensStats(own),
      lastVisitDate: latestVisitDate(own),
      goBack: goBackEntries.find((g) => g.restaurantId === restaurant.id) ?? null,
    }
  })
}

export interface SpotFilters {
  /** Matches restaurant names (case-insensitive). */
  query: string
  /** Spots must work for EVERY selected diet. */
  lensIds: string[]
  /** Empty means any price. */
  priceTiers: PriceTier[]
  /** Empty means any neighborhood. */
  neighborhood: string
  goBackOnly: boolean
}

export const EMPTY_FILTERS: SpotFilters = {
  query: '',
  lensIds: [],
  priceTiers: [],
  neighborhood: '',
  goBackOnly: false,
}

/** Filters that are set, not counting the search box (which is always visible). */
export function countActiveFilters(filters: SpotFilters): number {
  return (
    filters.lensIds.length +
    filters.priceTiers.length +
    (filters.neighborhood ? 1 : 0) +
    (filters.goBackOnly ? 1 : 0)
  )
}

export function filterSpots(spots: readonly Spot[], filters: SpotFilters): Spot[] {
  const query = filters.query.trim().toLowerCase()
  return spots.filter(({ restaurant, stats, goBack }) => {
    if (query && !restaurant.name.toLowerCase().includes(query)) return false
    if (filters.priceTiers.length > 0 && !filters.priceTiers.includes(restaurant.priceTier))
      return false
    if (filters.neighborhood && restaurant.neighborhood !== filters.neighborhood) return false
    if (filters.goBackOnly && !goBack) return false
    return filters.lensIds.every((lensId) => {
      const stat = stats.find((s) => s.lensId === lensId)
      return stat !== undefined && meetsFit(stat)
    })
  })
}

/** Most recently visited first; never-visited spots last; ties by name. */
export function sortSpots(spots: readonly Spot[]): Spot[] {
  return [...spots].sort((a, b) => {
    if (a.lastVisitDate !== b.lastVisitDate) {
      if (a.lastVisitDate === null) return 1
      if (b.lastVisitDate === null) return -1
      return b.lastVisitDate.localeCompare(a.lastVisitDate)
    }
    return a.restaurant.name.localeCompare(b.restaurant.name)
  })
}

/** Filters live in the URL so a filtered view survives refresh, back and sharing. */
export function parseFilters(params: URLSearchParams): SpotFilters {
  const list = (key: string) => params.get(key)?.split(',').filter(Boolean) ?? []
  return {
    query: params.get('q') ?? '',
    lensIds: list('diet'),
    priceTiers: list('price')
      .map(Number)
      .filter((n): n is PriceTier => (PRICE_TIERS as readonly number[]).includes(n)),
    neighborhood: params.get('hood') ?? '',
    goBackOnly: params.get('goback') === '1',
  }
}

export function serializeFilters(filters: SpotFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.lensIds.length) params.set('diet', filters.lensIds.join(','))
  if (filters.priceTiers.length) params.set('price', [...filters.priceTiers].sort().join(','))
  if (filters.neighborhood) params.set('hood', filters.neighborhood)
  if (filters.goBackOnly) params.set('goback', '1')
  return params
}
