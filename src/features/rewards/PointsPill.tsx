import { Gem } from 'lucide-react'
import { Link } from 'react-router'
import { useRewardsSummary } from '@/hooks/queries'
import { formatPoints } from './rewardMeta'

/** A small link to Rewards that shows the balance. Shows nothing until it is known. */
export function PointsPill() {
  const summary = useRewardsSummary()
  if (!summary.data) return null
  return (
    <Link
      to="/rewards"
      aria-label={`${formatPoints(summary.data.balance)} points, open Rewards`}
      className="inline-flex min-h-touch items-center gap-2 rounded-control border border-primary/50 px-3 text-sm font-semibold text-primary-strong transition-colors hover:bg-primary-soft"
    >
      <Gem aria-hidden className="size-4" />
      <span>{formatPoints(summary.data.balance)} points</span>
    </Link>
  )
}
