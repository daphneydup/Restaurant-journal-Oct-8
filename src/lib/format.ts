import { parseISODate } from './dates'
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

const visitDateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** "Mon, Oct 5, 2026" from a `YYYY-MM-DD` visit date. */
export function formatVisitDate(isoDate: string): string {
  return visitDateFormat.format(parseISODate(isoDate))
}

/** ["Vegan"] -> "Vegan"; two -> "Vegan and Steak"; three -> "Vegan, Steak and Gluten-free". */
export function joinList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}
