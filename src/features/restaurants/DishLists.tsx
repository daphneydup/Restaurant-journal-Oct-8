import { Share2, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Link } from 'react-router'
import { LensIcon, VisuallyHidden } from '@/components'
import type { DietLens, Dish, DishVerdict } from '@/types'

function DishColumn({
  verdict,
  dishes,
  lenses,
}: {
  verdict: DishVerdict
  dishes: readonly Dish[]
  lenses: readonly DietLens[]
}) {
  const again = verdict === 'order-again'
  const Icon = again ? ThumbsUp : ThumbsDown
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 font-sans text-base font-semibold">
        <Icon aria-hidden className={again ? 'size-4 text-basil-strong' : 'size-4 text-danger'} />
        {again ? 'Order again' : 'Skip'}
      </h3>
      {dishes.length === 0 ? (
        <p className="text-sm text-ink-muted">
          {again ? 'No favorites saved yet.' : 'Nothing to skip so far.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dishes.map((dish) => {
            const suits = lenses.filter((l) => dish.lensIds.includes(l.id))
            return (
              <li
                key={dish.id}
                className="flex items-center justify-between gap-2 rounded-md bg-surface-sunken py-1 pr-1 pl-3"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{dish.name}</span>
                  {suits.length > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                      {suits.map((l) => (
                        <LensIcon key={l.id} icon={l.icon} className="size-3.5" />
                      ))}
                      <VisuallyHidden>
                        Works for {suits.map((l) => l.shortLabel).join(', ')}
                      </VisuallyHidden>
                      <span aria-hidden>{suits.map((l) => l.shortLabel).join(', ')}</span>
                    </span>
                  )}
                </span>
                <Link
                  to={`/share/dish/${dish.id}`}
                  aria-label={`Share ${dish.name}`}
                  className="flex size-touch shrink-0 items-center justify-center rounded-pill hover:bg-surface"
                >
                  <Share2 aria-hidden className="size-4" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function DishLists({
  dishes,
  lenses,
}: {
  dishes: readonly Dish[]
  lenses: readonly DietLens[]
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <DishColumn
        verdict="order-again"
        dishes={dishes.filter((d) => d.verdict === 'order-again')}
        lenses={lenses}
      />
      <DishColumn
        verdict="skip"
        dishes={dishes.filter((d) => d.verdict === 'skip')}
        lenses={lenses}
      />
    </div>
  )
}
