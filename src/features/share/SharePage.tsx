import { ArrowLeft, Share2 } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { NotFound } from '@/app/layouts/NotFound'
import {
  EmptyState,
  ButtonLink,
  ErrorState,
  LoadingRegion,
  PageHeader,
  Skeleton,
} from '@/components'
import {
  useDietLenses,
  useDish,
  useProfile,
  useRestaurant,
  useRestaurantDishes,
  useRestaurantVisits,
} from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { CopyLinkPanel } from './CopyLinkPanel'
import { ShareActions } from './ShareActions'
import { dishShareContent, restaurantShareContent } from './shareContent'
import { DishShareCard, RestaurantShareCard } from './ShareCard'

function Frame({ children, back }: { children: React.ReactNode; back: string }) {
  return (
    <>
      <PageHeader title="Share" description="A clean card you can send to friends." />
      <Link
        to={back}
        className="mb-4 inline-flex min-h-touch items-center gap-2 font-medium text-primary-strong underline"
      >
        <ArrowLeft aria-hidden className="size-4" /> Back
      </Link>
      <div className="flex flex-col gap-5">{children}</div>
    </>
  )
}

function Loading() {
  return (
    <LoadingRegion label="Loading share card" className="flex flex-col gap-4">
      <Skeleton className="h-72 rounded-sheet" />
      <Skeleton className="h-28 rounded-card" />
    </LoadingRegion>
  )
}

function RestaurantShare({ id }: { id: string }) {
  const restaurant = useRestaurant(id)
  const visits = useRestaurantVisits(id)
  const dishes = useRestaurantDishes(id)
  const lenses = useDietLenses()
  const profile = useProfile()
  const queries = [restaurant, visits, dishes, lenses, profile]
  useDocumentTitle(restaurant.data ? `Share ${restaurant.data.name}` : 'Share')

  if (queries.some((q) => q.isError)) {
    return (
      <ErrorState
        title="We couldn’t load this share card"
        onRetry={() => queries.forEach((q) => q.isError && void q.refetch())}
      />
    )
  }
  if (restaurant.data === null) return <NotFoundShare />
  if (!restaurant.data || !visits.data || !dishes.data || !lenses.data || !profile.data)
    return <Loading />

  return (
    <Frame back={`/spots/${id}`}>
      <RestaurantShareCard
        restaurant={restaurant.data}
        visits={visits.data}
        dishes={dishes.data}
        lenses={lenses.data}
        sharedBy={profile.data.displayName}
      />
      <ShareActions
        content={restaurantShareContent({
          restaurant: restaurant.data,
          visits: visits.data,
          dishes: dishes.data,
          lenses: lenses.data,
          sharedBy: profile.data.displayName,
        })}
      />
      <CopyLinkPanel path={`/share/restaurant/${id}`} />
    </Frame>
  )
}

function DishShare({ id }: { id: string }) {
  const dish = useDish(id)
  const restaurant = useRestaurant(dish.data?.restaurantId)
  const lenses = useDietLenses()
  const profile = useProfile()
  const queries = [dish, restaurant, lenses, profile]
  useDocumentTitle(dish.data ? `Share ${dish.data.name}` : 'Share')

  if (queries.some((q) => q.isError)) {
    return (
      <ErrorState
        title="We couldn’t load this share card"
        onRetry={() => queries.forEach((q) => q.isError && void q.refetch())}
      />
    )
  }
  if (dish.data === null || restaurant.data === null) return <NotFoundShare />
  if (!dish.data || !restaurant.data || !lenses.data || !profile.data) return <Loading />

  return (
    <Frame back={`/spots/${dish.data.restaurantId}`}>
      <DishShareCard
        dish={dish.data}
        restaurant={restaurant.data}
        lenses={lenses.data}
        sharedBy={profile.data.displayName}
      />
      <ShareActions
        content={dishShareContent({
          dish: dish.data,
          restaurant: restaurant.data,
          lenses: lenses.data,
          sharedBy: profile.data.displayName,
        })}
      />
      <CopyLinkPanel path={`/share/dish/${id}`} />
    </Frame>
  )
}

function NotFoundShare() {
  return (
    <EmptyState
      icon={Share2}
      title="That share link doesn’t work"
      description="What it pointed to may have been removed."
      action={<ButtonLink to="/">Back to My Spots</ButtonLink>}
    />
  )
}

export function SharePage() {
  const { kind, id } = useParams()
  if (!id) return <NotFound />
  if (kind === 'restaurant') return <RestaurantShare id={id} />
  if (kind === 'dish') return <DishShare id={id} />
  return <NotFound />
}
