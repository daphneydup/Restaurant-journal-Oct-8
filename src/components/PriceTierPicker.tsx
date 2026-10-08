import { formatPriceTier, PRICE_TIER_LABELS } from '@/lib/format'
import { PRICE_TIERS, type PriceTier } from '@/types'
import { SegmentedControl } from './SegmentedControl'

const OPTIONS = PRICE_TIERS.map((tier) => ({
  value: String(tier),
  label: formatPriceTier(tier),
  hint: PRICE_TIER_LABELS[tier].toLowerCase(),
}))

export function PriceTierPicker({
  value,
  onChange,
  legend = 'Price',
}: {
  value: PriceTier | undefined
  onChange: (tier: PriceTier) => void
  legend?: string
}) {
  return (
    <SegmentedControl
      legend={legend}
      options={OPTIONS}
      value={value === undefined ? undefined : String(value)}
      onChange={(v) => onChange(Number(v) as PriceTier)}
    />
  )
}
