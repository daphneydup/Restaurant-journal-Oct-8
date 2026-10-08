import { Share2, Store, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  LoadingRegion,
  PageHeader,
  Skeleton,
  useToast,
} from '@/components'
import {
  useDeleteRestaurant,
  useDietLenses,
  useRestaurant,
  useRestaurantDishes,
  useRestaurantVisits,
} from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useNow } from '@/hooks/useNow'
import { lensStats } from '@/lib/dietFit'
import { formatPriceTier } from '@/lib/format'
import { DietBreakdown } from './DietBreakdown'
import { DishLists } from './DishLists'
import { GoBackToggle } from './GoBackToggle'
import { PhotoGallery } from './PhotoGallery'
import { VisitHistory } from './VisitHistory'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <h2 className="text-xl">{title}</h2>
      {children}
    </Card>
  )
}

export function RestaurantDetailPage() {
  const { restaurantId } = useParams()
  const navigate = useNavigate()
  const now = useNow()
  const { showToast } = useToast()
  const restaurant = useRestaurant(restaurantId)
  const visits = useRestaurantVisits(restaurantId)
  const dishes = useRestaurantDishes(restaurantId)
  const lenses = useDietLenses()
  const deleteRestaurant = useDeleteRestaurant()
  const [confirmRemove, setConfirmRemove] = useState(false)
  useDocumentTitle(restaurant.data?.name ?? 'Restaurant')

  const queries = [restaurant, visits, dishes, lenses]
  if (queries.some((q) => q.isError)) {
    return (
      <ErrorState
        title="We couldn’t load this spot"
        onRetry={() => {
          for (const query of queries) if (query.isError) void query.refetch()
        }}
      />
    )
  }
  if (!restaurant.data && !restaurant.isPending) {
    return (
      <EmptyState
        icon={Store}
        title="We couldn’t find that restaurant"
        description="It may have been removed."
        action={<ButtonLink to="/">Back to My Spots</ButtonLink>}
      />
    )
  }
  if (!restaurant.data || !visits.data || !dishes.data || !lenses.data) {
    return (
      <LoadingRegion label="Loading restaurant" className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </LoadingRegion>
    )
  }

  const { id, name, neighborhood, priceTier, cuisine } = restaurant.data
  const photos = [
    ...visits.data.flatMap((v) => v.photoUrls),
    ...dishes.data.flatMap((d) => (d.photoUrl ? [d.photoUrl] : [])),
  ]

  function remove() {
    deleteRestaurant.mutate(id, {
      onSuccess: () => {
        showToast(`${name} removed`)
        void navigate('/')
      },
      onError: () => {
        setConfirmRemove(false)
        showToast('We couldn’t remove that spot. Please try again.', { tone: 'error' })
      },
    })
  }

  return (
    <>
      <PageHeader
        title={name}
        description={[neighborhood, formatPriceTier(priceTier), cuisine]
          .filter(Boolean)
          .join(' · ')}
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/log?restaurantId=${id}`}>Log a visit</ButtonLink>
          <ButtonLink to={`/share/restaurant/${id}`} variant="secondary">
            <Share2 aria-hidden className="size-4" /> Share
          </ButtonLink>
        </div>

        <Card>
          <GoBackToggle restaurantId={id} now={now} />
        </Card>

        <Section title="How each diet fared">
          <DietBreakdown lenses={lenses.data} stats={lensStats(visits.data)} visits={visits.data} />
        </Section>

        <Section title="Dishes">
          <DishLists dishes={dishes.data} lenses={lenses.data} />
        </Section>

        <Section title={`Visit history (${visits.data.length})`}>
          <VisitHistory visits={visits.data} lenses={lenses.data} now={now} />
        </Section>

        {photos.length > 0 && (
          <Section title="Photos">
            <PhotoGallery photos={photos} name={name} />
          </Section>
        )}

        <Button
          variant="ghost"
          className="self-start text-danger hover:bg-danger-soft"
          onClick={() => setConfirmRemove(true)}
        >
          <Trash2 aria-hidden className="size-4" /> Remove this spot
        </Button>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${name}?`}
        confirmLabel="Remove spot"
        busy={deleteRestaurant.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={remove}
      >
        <p>
          This also deletes its {visits.data.length} {visits.data.length === 1 ? 'visit' : 'visits'}
          , dishes and Go-Back entry. This can’t be undone.
        </p>
      </ConfirmDialog>
    </>
  )
}
