import { ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ReactNode } from 'react'
import { DietFitBadge, LensIcon, PriceTierBadge } from '@/components'
import { workedTally } from '@/lib/dietFit'
import { lensStats } from '@/lib/dietFit'
import type { DietLens, Dish, Restaurant, Visit } from '@/types'

function CardShell({ children, byline }: { children: ReactNode; byline: string }) {
  return (
    <article className="overflow-hidden rounded-sheet bg-surface shadow-raised">
      {children}
      <footer className="flex items-center justify-between gap-3 border-t border-line bg-canvas px-5 py-3 text-sm">
        <span className="font-display font-semibold text-primary-strong">Table for Everyone</span>
        <span className="text-ink-muted">{byline}</span>
      </footer>
    </article>
  )
}

export function RestaurantShareCard({
  restaurant,
  visits,
  dishes,
  lenses,
  sharedBy,
}: {
  restaurant: Restaurant
  visits: readonly Visit[]
  dishes: readonly Dish[]
  lenses: readonly DietLens[]
  sharedBy: string
}) {
  const stats = lensStats(visits)
  const badges = lenses.flatMap((lens) => {
    const stat = stats.find((s) => s.lensId === lens.id)
    return stat ? [{ lens, average: stat.average }] : []
  })
  const worked = workedTally(visits)
  const favorites = dishes.filter((d) => d.verdict === 'order-again').slice(0, 4)

  return (
    <CardShell byline={`Recommended by ${sharedBy}`}>
      <header className="bg-primary px-5 py-6 text-on-primary">
        <h2 className="text-3xl">{restaurant.name}</h2>
        <p className="mt-1">
          {restaurant.neighborhood} · <PriceTierBadge tier={restaurant.priceTier} />
          {restaurant.cuisine && ` · ${restaurant.cuisine}`}
        </p>
      </header>

      <div className="flex flex-col gap-5 p-5">
        {badges.length > 0 ? (
          <section aria-labelledby="share-fit">
            <h3
              id="share-fit"
              className="mb-2 font-sans text-sm font-semibold text-ink-muted uppercase"
            >
              How it works for each diet
            </h3>
            <ul className="flex flex-wrap gap-2">
              {badges.map(({ lens, average }) => (
                <li key={lens.id}>
                  <DietFitBadge lens={lens} average={average} />
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-ink-muted">No diet ratings yet.</p>
        )}

        {worked.total > 0 && (
          <p className="text-lg">
            Worked for everyone in{' '}
            <strong>
              {worked.yes} of {worked.total}
            </strong>{' '}
            {worked.total === 1 ? 'visit' : 'visits'}.
          </p>
        )}

        {favorites.length > 0 && (
          <section aria-labelledby="share-dishes">
            <h3
              id="share-dishes"
              className="mb-2 font-sans text-sm font-semibold text-ink-muted uppercase"
            >
              Order these
            </h3>
            <ul className="flex flex-col gap-1.5">
              {favorites.map((dish) => (
                <li key={dish.id} className="flex items-center gap-2">
                  <ThumbsUp aria-hidden className="size-4 shrink-0 text-basil-strong" />
                  {dish.name}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </CardShell>
  )
}

export function DishShareCard({
  dish,
  restaurant,
  lenses,
  sharedBy,
}: {
  dish: Dish
  restaurant: Restaurant
  lenses: readonly DietLens[]
  sharedBy: string
}) {
  const again = dish.verdict === 'order-again'
  const suits = lenses.filter((l) => dish.lensIds.includes(l.id))
  const Icon = again ? ThumbsUp : ThumbsDown

  return (
    <CardShell byline={`${again ? 'Recommended' : 'Skipped'} by ${sharedBy}`}>
      <header
        className={again ? 'bg-basil px-5 py-6 text-white' : 'bg-surface-sunken px-5 py-6 text-ink'}
      >
        <p className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase">
          <Icon aria-hidden className="size-4" /> {again ? 'Order again' : 'Skip this one'}
        </p>
        <h2 className="text-3xl">{dish.name}</h2>
        <p className="mt-1">
          at {restaurant.name} · {restaurant.neighborhood}
        </p>
      </header>

      <div className="flex flex-col gap-4 p-5">
        {dish.photoUrl && (
          <img
            src={dish.photoUrl}
            alt={`${dish.name} at ${restaurant.name}`}
            className="aspect-video w-full rounded-md object-cover"
          />
        )}
        {suits.length > 0 ? (
          <section aria-labelledby="share-suits">
            <h3
              id="share-suits"
              className="mb-2 font-sans text-sm font-semibold text-ink-muted uppercase"
            >
              Works for
            </h3>
            <ul className="flex flex-wrap gap-2">
              {suits.map((lens) => (
                <li
                  key={lens.id}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-basil-soft px-3 py-1 text-sm font-semibold text-basil-strong"
                >
                  <LensIcon icon={lens.icon} /> {lens.shortLabel}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="text-ink-muted">Not tagged for a particular diet.</p>
        )}
      </div>
    </CardShell>
  )
}
