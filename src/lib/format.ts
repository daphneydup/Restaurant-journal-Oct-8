import type { PriceTier, RatingValue } from '@/types'

export const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  1: 'Budget',
  2: 'Moderate',
  3: 'Upscale',
  4: 'Splurge',
}

/** 1 -> "$", 3 -> "$$$". */
export function formatPriceTier(tier: PriceTier): string {
  return '$'.repeat(tier)
}

export const RATING_WORDS: Record<RatingValue, string> = {
  1: 'Poor',
  2: 'Meh',
  3: 'Okay',
  4: 'Good',
  5: 'Great',
}
