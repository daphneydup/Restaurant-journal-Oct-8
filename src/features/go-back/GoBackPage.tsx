import { Bookmark } from 'lucide-react'
import {
  Button,
  ButtonLink,
  DietFitBadge,
  EmptyState,
  ErrorState,
  LoadingRegion,
  PageHeader,
  PriceTierBadge,
  Skeleton,
  useToast,
} from '@/components'
import { useDietLenses, useRemoveFromGoBack } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useNow } from '@/hooks/useNow'
import { goBackMessage } from '@/lib/relativeTime'
import { useSpots } from '@/features/restaurants/useSpots'
import { Link } from 'react-router'
import { buildGoBackList, type GoBackItem } from './goBackList'
import type { DietLens } from '@/types'

function GoBackCard({ item, lenses }: { item: GoBackItem; lenses: readonly DietLens[] }) {
  const { showToast } = useToast()
  const remove = useRemoveFromGoBack()
  const { restaurant, entry, spot } = item
  const badges = lenses.flatMap((lens) => {
    const stat = spot.stats.find((s) => s.lensId === lens.id)
    return stat ? [{ lens, average: stat.average }] : []
  })

  return (
    <li className="relative rounded-card bg-surface p-4 shadow-card has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus md:p-5">
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
      </p>

      <p className="mt-3 font-medium text-primary-strong">
        {goBackMessage({
          daysSinceVisit: item.daysSinceVisit,
          daysSinceSaved: item.daysSinceSaved,
        })}
      </p>
      {entry.note && <p className="mt-1 border-l-4 border-saffron pl-3 italic">{entry.note}</p>}

      {badges.length > 0 && (
        <ul aria-label="Diet fit" className="mt-3 flex flex-wrap gap-2">
          {badges.map(({ lens, average }) => (
            <li key={lens.id}>
              <DietFitBadge lens={lens} average={average} />
            </li>
          ))}
        </ul>
      )}

      {/* Raised above the card's stretched link so these stay separately clickable. */}
      <div className="relative z-10 mt-4 flex flex-wrap gap-2">
        <ButtonLink to={`/log?restaurantId=${restaurant.id}`}>Log a visit</ButtonLink>
        <Button
          variant="secondary"
          disabled={remove.isPending}
          aria-label={`Remove ${restaurant.name} from Go-Back list`}
          onClick={() =>
            remove.mutate(entry.id, {
              onSuccess: () => showToast(`${restaurant.name} removed from your Go-Back list`),
              onError: () =>
                showToast('We couldn’t update your list. Please try again.', { tone: 'error' }),
            })
          }
        >
          Remove
        </Button>
      </div>
    </li>
  )
}

export function GoBackPage() {
  useDocumentTitle('Go Back')
  const now = useNow()
  const { spots, isPending, isError, refetch } = useSpots()
  const lenses = useDietLenses()

  let body
  if (isError || lenses.isError) {
    body = (
      <ErrorState
        title="We couldn’t load your Go-Back list"
        onRetry={() => {
          refetch()
          if (lenses.isError) void lenses.refetch()
        }}
      />
    )
  } else if (isPending || !spots || !lenses.data) {
    body = (
      <LoadingRegion label="Loading your Go-Back list" className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-40 rounded-card" />
        ))}
      </LoadingRegion>
    )
  } else {
    const items = buildGoBackList(spots, now)
    body =
      items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Nothing to revisit yet"
          description="Flip on “Go back” for any spot you’d love to return to, and it will wait for you here."
          action={<ButtonLink to="/">Browse my spots</ButtonLink>}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <GoBackCard key={item.entry.id} item={item} lenses={lenses.data} />
          ))}
        </ul>
      )
  }

  return (
    <>
      <PageHeader
        title="Go Back"
        description="Places you want to revisit, the ones you’ve missed longest first."
      />
      {body}
    </>
  )
}
