import { useSearchParams } from 'react-router'
import { ErrorState, LoadingRegion, PageHeader, Skeleton } from '@/components'
import { useDietLenses, useProfile, useRestaurants } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { LogVisitForm } from './LogVisitForm'

function FormSkeleton() {
  return (
    <LoadingRegion label="Loading the form" className="flex flex-col gap-5">
      <Skeleton className="h-56" />
      <Skeleton className="h-72" />
      <Skeleton className="h-16" />
    </LoadingRegion>
  )
}

export function LogVisitPage() {
  useDocumentTitle('Log a Visit')
  const [params] = useSearchParams()
  const lenses = useDietLenses()
  const restaurants = useRestaurants()
  const profile = useProfile()

  return (
    <>
      <PageHeader
        title="Log a Visit"
        description="Rate how it worked for each diet. Most visits take about 30 seconds."
      />
      {lenses.isError || restaurants.isError || profile.isError ? (
        <ErrorState
          title="We couldn’t load the form"
          onRetry={() => {
            for (const query of [lenses, restaurants, profile])
              if (query.isError) void query.refetch()
          }}
        />
      ) : lenses.data && restaurants.data && profile.data ? (
        <LogVisitForm
          lenses={lenses.data}
          restaurants={restaurants.data}
          defaultLensIds={profile.data.defaultLensIds}
          homeCity={profile.data.homeCity}
          initialRestaurantId={params.get('restaurantId') ?? undefined}
        />
      ) : (
        <FormSkeleton />
      )}
    </>
  )
}
