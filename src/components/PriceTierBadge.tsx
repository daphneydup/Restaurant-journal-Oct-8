import { formatPriceTier, PRICE_TIER_LABELS } from '@/lib/format'
import type { PriceTier } from '@/types'
import { VisuallyHidden } from './VisuallyHidden'

/** "$$", read aloud as "$$ (moderate)". */
export function PriceTierBadge({ tier }: { tier: PriceTier }) {
  return (
    <span className="font-semibold">
      {formatPriceTier(tier)}{' '}
      <VisuallyHidden>({PRICE_TIER_LABELS[tier].toLowerCase()})</VisuallyHidden>
    </span>
  )
}
