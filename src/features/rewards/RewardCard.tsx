import { Button } from '@/components'
import type { Reward } from '@/types'
import { CATEGORY_META, formatPoints } from './rewardMeta'

export function RewardCard({
  reward,
  balance,
  onRedeem,
}: {
  reward: Reward
  balance: number
  onRedeem: (reward: Reward) => void
}) {
  const { icon: Icon, label } = CATEGORY_META[reward.category]
  const shortBy = reward.cost - balance
  return (
    <li className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-primary-strong uppercase">
          <Icon aria-hidden className="size-4" /> {label}
        </span>
        <span className="font-display text-xl text-ink">
          {formatPoints(reward.cost)}
          <span className="ml-1 font-sans text-xs font-medium text-ink-muted">pts</span>
        </span>
      </div>
      <div className="flex-1">
        <h3 className="text-lg">{reward.title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{reward.description}</p>
        <p className="mt-2 text-sm text-ink">{reward.partner}</p>
      </div>
      {shortBy > 0 ? (
        <Button
          variant="secondary"
          disabled
          aria-label={`Redeem ${reward.title}, ${formatPoints(shortBy)} more points needed`}
        >
          {formatPoints(shortBy)} more points
        </Button>
      ) : (
        <Button
          aria-label={`Redeem ${reward.title} for ${formatPoints(reward.cost)} points`}
          onClick={() => onRedeem(reward)}
        >
          Redeem
        </Button>
      )}
    </li>
  )
}
