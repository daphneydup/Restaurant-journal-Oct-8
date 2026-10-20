import { Gem } from 'lucide-react'
import { formatPoints } from './rewardMeta'
import type { RewardsSummary } from '@/types'

/** The balance, large, with how far away the next perk is. */
export function BalanceHero({
  summary,
  pointsToNext,
}: {
  summary: RewardsSummary
  /** Points still needed for the cheapest perk not yet affordable (null if all are). */
  pointsToNext: number | null
}) {
  return (
    <section
      aria-labelledby="balance-heading"
      className="relative overflow-hidden rounded-card bg-surface p-6 shadow-raised md:p-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-pill bg-primary/10 blur-3xl"
      />
      <p
        id="balance-heading"
        className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary-strong uppercase"
      >
        <Gem aria-hidden className="size-4" /> Your points
      </p>
      <p className="mt-2 font-display text-5xl text-ink md:text-6xl">
        {formatPoints(summary.balance)}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        {pointsToNext === null
          ? 'You can afford every perk on offer.'
          : `${formatPoints(pointsToNext)} more points unlock your next perk.`}
      </p>
      <p className="mt-4 border-t border-line pt-3 text-sm text-ink-muted">
        {formatPoints(summary.lifetimeEarned)} points earned in total
      </p>
    </section>
  )
}
