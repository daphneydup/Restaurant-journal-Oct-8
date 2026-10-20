import { SlidersHorizontal, UtensilsCrossed } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingRegion,
  PageHeader,
  SearchField,
  Skeleton,
} from '@/components'
import { useDietLenses } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useNow } from '@/hooks/useNow'
import { GuestBanner } from '@/features/account/GuestBanner'
import { PointsPill } from '@/features/rewards/PointsPill'
import { FiltersSheet } from './FiltersSheet'
import { SpotCard } from './SpotCard'
import {
  countActiveFilters,
  EMPTY_FILTERS,
  filterSpots,
  parseFilters,
  serializeFilters,
  sortSpots,
  type SpotFilters,
} from './spots'
import { useSpots } from './useSpots'

function ListSkeleton() {
  return (
    <LoadingRegion label="Loading your spots" className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-36 rounded-card" />
      ))}
    </LoadingRegion>
  )
}

export function MySpotsPage() {
  useDocumentTitle('My Spots')
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { spots, isPending, isError, refetch } = useSpots()
  const lenses = useDietLenses()

  const setFilters = (next: SpotFilters) => setParams(serializeFilters(next), { replace: true })

  const visible = useMemo(
    () => (spots ? sortSpots(filterSpots(spots, filters)) : []),
    [spots, filters],
  )
  const neighborhoods = useMemo(
    () =>
      [...new Set((spots ?? []).map((s) => s.restaurant.neighborhood))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [spots],
  )
  const activeCount = countActiveFilters(filters)
  const filtered = activeCount > 0 || filters.query.trim() !== ''

  let body
  if (isError || lenses.isError) {
    body = (
      <ErrorState
        title="We couldn’t load your spots"
        onRetry={() => {
          refetch()
          if (lenses.isError) void lenses.refetch()
        }}
      />
    )
  } else if (isPending || !lenses.data || !spots) {
    body = <ListSkeleton />
  } else if (spots.length === 0) {
    body = (
      <EmptyState
        icon={UtensilsCrossed}
        title="No spots yet"
        description="Log your first visit and rate how it worked for each diet. It takes about 30 seconds."
        action={<ButtonLink to="/log">Log a visit</ButtonLink>}
      />
    )
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        icon={UtensilsCrossed}
        title="No spots match"
        description="Try a different search, or loosen your filters."
        action={
          <Button variant="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear search and filters
          </Button>
        }
      />
    )
  } else {
    body = (
      <>
        <p aria-live="polite" className="mb-3 text-sm text-ink-muted">
          {filtered
            ? `Showing ${visible.length} of ${spots.length} spots`
            : `${spots.length} spots`}
        </p>
        <ul className="flex flex-col gap-3">
          {visible.map((spot) => (
            <SpotCard key={spot.restaurant.id} spot={spot} lenses={lenses.data} now={now} />
          ))}
        </ul>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="My Spots"
        description="Your trusted shortlist of places that work for everyone."
        actions={
          <>
            <PointsPill />
            <ButtonLink to="/log">Log a visit</ButtonLink>
          </>
        }
      />

      {spots && spots.length > 0 && <GuestBanner />}

      <div className="mb-5 flex gap-2">
        <div className="min-w-0 flex-1">
          <SearchField
            label="Search by name"
            placeholder="Search by name"
            value={filters.query}
            onChange={(query) => setFilters({ ...filters, query })}
          />
        </div>
        <Button
          variant="secondary"
          onClick={() => setFiltersOpen(true)}
          disabled={!spots || !lenses.data}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          Filters{activeCount > 0 && <span aria-hidden> ({activeCount})</span>}
          {activeCount > 0 && <span className="sr-only">, {activeCount} active</span>}
        </Button>
      </div>

      {body}

      {lenses.data && (
        <FiltersSheet
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          filters={filters}
          onChange={setFilters}
          lenses={lenses.data}
          neighborhoods={neighborhoods}
          resultCount={visible.length}
        />
      )}
    </>
  )
}
