import {
  BadgePercent,
  CakeSlice,
  Sparkles,
  Soup,
  UtensilsCrossed,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import type { RewardCategory } from '@/types'

export const CATEGORY_META: Record<RewardCategory, { label: string; icon: LucideIcon }> = {
  appetizer: { label: 'Appetizer', icon: Soup },
  drink: { label: 'Drinks', icon: Wine },
  dessert: { label: 'Dessert', icon: CakeSlice },
  entree: { label: 'Entrée', icon: UtensilsCrossed },
  discount: { label: 'Discount', icon: BadgePercent },
  experience: { label: 'Experience', icon: Sparkles },
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** "Jan 6, 2027" from an ISO timestamp. */
export function formatDay(iso: string): string {
  return dateFormat.format(new Date(iso))
}

/** 1500 -> "1,500". */
export const formatPoints = (points: number) => points.toLocaleString('en-US')
