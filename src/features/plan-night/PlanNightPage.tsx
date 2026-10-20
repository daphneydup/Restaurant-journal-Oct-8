import { Bookmark, CalendarHeart } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  ButtonLink,
  Card,
  Chip,
  DietFitBadge,
  EmptyState,
  ErrorState,
  LensIcon,
  LoadingRegion,
  PageHeader,
  PriceTierBadge,
  PriceTierPicker,
  Skeleton,
} from '@/components'
import { useDietLenses, useProfile } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useNow } from '@/hooks/useNow'
import { joinList } from '@/lib/format'
import { daysSince, formatSince } from '@/lib/relativeTime'
import { useSpots } from '@/features/restaurants/useSpots'
import type { DietLens, PriceTier } from '@/types'
import { planNight, type Match, type NeedsData } from './matching'
import { parsePlanParams, serializePlanParams } from './planParams'

const cardClasses =
  'relative rounded-card bg-surface p-4 shadow-card has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-focus md:p-5'
const stretchedLink = "outline-none after:absolute after:inset-0 after:content-['']"

function MatchCard({
  match,
  rank,
  lenses,
  now,
}: {
  match: Match
  rank: number
  lenses: readonly DietLens[]
  now: Date
}) {
  const { restaurant, visits, lastVisitDate, goBack } = match.spot
  const yes = visits.filter((v) => v.workedForEveryone === 'yes').length
  return (
    <li className={cardClasses}>
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-primary font-semibold text-on-primary"
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold">
            <span className="sr-only">Number {rank}: </span>
            <Link to={`/spots/${restaurant.id}`} className={stretchedLink}>
              {restaurant.name}
            </Link>
          </h3>
          <p className="text-sm text-ink-muted">
            {restaurant.neighborhood} · <PriceTierBadge tier={restaurant.priceTier} />
          </p>
        </div>
        {goBack && (
          <span className="flex shrink-0 items-center gap-1 rounded-pill bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-strong">
            <Bookmark aria-hidden className="size-3.5" /> Go back
          </span>
        )}
      </div>

      <ul aria-label="Diet fit" className="mt-3 flex flex-wrap gap-2">
        {match.lensResults.map((result) => {
          const lens = lenses.find((l) => l.id === result.lensId)
          return lens ? (
            <li key={lens.id}>
              <DietFitBadge lens={lens} average={result.average} />
            </li>
          ) : null
        })}
      </ul>

      <p className="mt-3 text-sm">
        Worked for everyone in <strong>{yes}</strong> of {visits.length}{' '}
        {visits.length === 1 ? 'visit' : 'visits'}
        {lastVisitDate && (
          <span className="text-ink-muted">
            {' '}
            · last visited {formatSince(daysSince(lastVisitDate, now))}
          </span>
        )}
      </p>
    </li>
  )
}

function NeedsDataCard({ item, lenses }: { item: NeedsData; lenses: readonly DietLens[] }) {
  const { restaurant } = item.spot
  const missing = item.missingLensIds.map((id) => lenses.find((l) => l.id === id)?.shortLabel ?? id)
  return (
    <li className={cardClasses}>
      <h3 className="font-display text-lg font-semibold">
        <Link to={`/spots/${restaurant.id}`} className={stretchedLink}>
          {restaurant.name}
        </Link>
      </h3>
      <p className="text-sm text-ink-muted">
        {restaurant.neighborhood} · <PriceTierBadge tier={restaurant.priceTier} />
      </p>
      <ul aria-label="Diet fit so far" className="mt-3 flex flex-wrap gap-2">
        {item.rated.map((result) => {
          const lens = lenses.find((l) => l.id === result.lensId)
          return lens ? (
            <li key={lens.id}>
              <DietFitBadge lens={lens} average={result.average} />
            </li>
          ) : null
        })}
      </ul>
      <p className="mt-3 text-sm text-ink-muted">Never rated for {joinList(missing)}.</p>
      <div className="relative z-10 mt-3">
        <ButtonLink to={`/log?restaurantId=${restaurant.id}`} variant="secondary">
          Log a visit
        </ButtonLink>
      </div>
    </li>
  )
}

export function PlanNightPage() {
  useDocumentTitle('Plan a Night Out')
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const profile = useProfile()
  const lenses = useDietLenses()
  const { spots, isError: spotsError, refetch } = useSpots()

  const plan = useMemo(
    () => parsePlanParams(params, profile.data?.defaultLensIds ?? []),
    [params, profile.data],
  )
  const result = useMemo(
    () =>
      spots ? planNight(spots, { lensIds: plan.lensIds, maxPriceTier: plan.maxPriceTier }) : null,
    [spots, plan],
  )

  const header = (
    <PageHeader
      title="Plan a Night Out"
      description="Pick the diets at the table and a budget. We’ll rank your own spots that work for everyone."
    />
  )

  if (spotsError || profile.isError || lenses.isError) {
    return (
      <>
        {header}
        <ErrorState
          title="We couldn’t load your spots"
          onRetry={() => {
            refetch()
            if (profile.isError) void profile.refetch()
            if (lenses.isError) void lenses.refetch()
          }}
        />
      </>
    )
  }
  if (!spots || !result || !lenses.data || !profile.data) {
    return (
      <>
        {header}
        <LoadingRegion label="Loading your spots" className="flex flex-col gap-3">
          <Skeleton className="h-48 rounded-card" />
          <Skeleton className="h-32 rounded-card" />
          <Skeleton className="h-32 rounded-card" />
        </LoadingRegion>
      </>
    )
  }

  const allLenses = lenses.data
  const setPlan = (next: Partial<typeof plan>) =>
    setParams(serializePlanParams({ ...plan, ...next }), { replace: true })
  const chosen = plan.lensIds.flatMap((id) => allLenses.find((l) => l.id === id) ?? [])
  const dietNames = joinList(chosen.map((l) => l.shortLabel))
  const { matches, needsData } = result

  return (
    <>
      {header}

      <Card className="mb-6 flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 font-semibold">Who’s at the table?</legend>
          <div className="flex flex-wrap gap-2">
            {allLenses.map((lens) => (
              <Chip
                key={lens.id}
                selected={plan.lensIds.includes(lens.id)}
                icon={<LensIcon icon={lens.icon} />}
                onClick={() =>
                  setPlan({
                    lensIds: plan.lensIds.includes(lens.id)
                      ? plan.lensIds.filter((id) => id !== lens.id)
                      : allLenses
                          .map((l) => l.id)
                          .filter((id) => id === lens.id || plan.lensIds.includes(id)),
                  })
                }
              >
                {lens.shortLabel}
              </Chip>
            ))}
          </div>
        </fieldset>
        <PriceTierPicker
          legend="Budget, up to"
          value={plan.maxPriceTier}
          onChange={(tier: PriceTier) => setPlan({ maxPriceTier: tier })}
        />
      </Card>

      {spots.length === 0 ? (
        <EmptyState
          icon={CalendarHeart}
          title="Log a few visits first"
          description="Plan a Night Out ranks the places you’ve already rated. Log your first visit to get started."
          action={<ButtonLink to="/log">Log a visit</ButtonLink>}
        />
      ) : plan.lensIds.length === 0 ? (
        <EmptyState
          icon={CalendarHeart}
          title="Pick who’s coming"
          description="Choose at least one diet above and your shortlist will appear here."
        />
      ) : (
        <section aria-labelledby="shortlist-heading" className="flex flex-col gap-4">
          <h2 id="shortlist-heading" className="text-xl">
            Your shortlist
          </h2>
          <p aria-live="polite" className="text-ink-muted">
            {matches.length === 0
              ? `No logged spots work for ${dietNames} within this budget yet.`
              : `${matches.length} ${matches.length === 1 ? 'spot works' : 'spots work'} for ${dietNames}, best first.`}
          </p>

          {matches.length > 0 ? (
            <ol className="flex flex-col gap-3">
              {matches.map((match, index) => (
                <MatchCard
                  key={match.spot.restaurant.id}
                  match={match}
                  rank={index + 1}
                  lenses={allLenses}
                  now={now}
                />
              ))}
            </ol>
          ) : (
            <EmptyState
              icon={CalendarHeart}
              title="Nothing fits yet"
              description="Try fewer diets or a higher budget, or log a visit to a new spot."
              action={<ButtonLink to="/log">Log a visit</ButtonLink>}
            />
          )}

          {needsData.length > 0 && (
            <section aria-labelledby="needs-data-heading" className="mt-4 flex flex-col gap-3">
              <h2 id="needs-data-heading" className="text-xl">
                Worth a closer look
              </h2>
              <p className="text-ink-muted">
                These look good so far, but you haven’t rated every diet at the table yet.
              </p>
              <ul className="flex flex-col gap-3">
                {needsData.map((item) => (
                  <NeedsDataCard key={item.spot.restaurant.id} item={item} lenses={allLenses} />
                ))}
              </ul>
            </section>
          )}
        </section>
      )}
    </>
  )
}
