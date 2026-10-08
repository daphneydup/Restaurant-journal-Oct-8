import { useMemo } from 'react'
import { useGoBackEntries, useRestaurants, useVisits } from '@/hooks/queries'
import { buildSpots } from './spots'

/**
 * Every restaurant joined with its visits and go-back entry. One loading / error state for the
 * three underlying queries, with a single `refetch` that retries whichever ones failed.
 */
export function useSpots() {
  const restaurants = useRestaurants()
  const visits = useVisits()
  const goBack = useGoBackEntries()
  const queries = [restaurants, visits, goBack]

  const spots = useMemo(
    () =>
      restaurants.data && visits.data && goBack.data
        ? buildSpots(restaurants.data, visits.data, goBack.data)
        : undefined,
    [restaurants.data, visits.data, goBack.data],
  )

  return {
    spots,
    isError: queries.some((q) => q.isError),
    isPending: !queries.some((q) => q.isError) && spots === undefined,
    refetch: () => {
      for (const query of queries) if (query.isError) void query.refetch()
    },
  }
}
