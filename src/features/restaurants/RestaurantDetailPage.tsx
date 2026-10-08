import { Store } from 'lucide-react'
import { useParams } from 'react-router'
import {
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingRegion,
  PageHeader,
  Skeleton,
} from '@/components'
import { useRestaurant, useRestaurantVisits } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatPriceTier } from '@/lib/format'

/**
 * Temporary stand-in: shows just enough real data to confirm a logged visit was saved.
 * The full detail page (breakdown, dishes, photos, share) is built in stage (d).
 */
export function RestaurantDetailPage() {
  const { restaurantId } = useParams()
  const restaurant = useRestaurant(restaurantId)
  const visits = useRestaurantVisits(restaurantId)
  useDocumentTitle(restaurant.data?.name ?? 'Restaurant')

  if (restaurant.isError || visits.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void restaurant.refetch()
          void visits.refetch()
        }}
      />
    )
  }
  if (restaurant.isPending || visits.isPending) {
    return (
      <LoadingRegion label="Loading restaurant">
        <Skeleton className="h-24" />
      </LoadingRegion>
    )
  }
  if (!restaurant.data) {
    return (
      <EmptyState
        icon={Store}
        title="We couldn’t find that restaurant"
        description="It may have been deleted."
        action={<ButtonLink to="/">Back to My Spots</ButtonLink>}
      />
    )
  }

  const { name, neighborhood, priceTier } = restaurant.data
  return (
    <>
      <PageHeader
        title={name}
        description={`${neighborhood} · ${formatPriceTier(priceTier)}`}
        actions={
          <ButtonLink to={`/log?restaurantId=${restaurant.data.id}`}>Log another visit</ButtonLink>
        }
      />
      <p className="mb-3 font-medium">
        {visits.data.length} {visits.data.length === 1 ? 'visit' : 'visits'} logged
      </p>
      <ul className="flex flex-col gap-2">
        {visits.data.map((visit) => (
          <li key={visit.id} className="rounded-card bg-surface p-3 shadow-card">
            {visit.date} · worked for everyone: {visit.workedForEveryone}
          </li>
        ))}
      </ul>
    </>
  )
}
