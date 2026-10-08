import { Bookmark, CalendarHeart, Plus, User, UtensilsCrossed, type LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Match only the exact path (needed for "/"). */
  end?: boolean
  /** The primary action, rendered raised in the mobile tab bar. */
  primary?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'My Spots', icon: UtensilsCrossed, end: true },
  { to: '/go-back', label: 'Go Back', icon: Bookmark },
  { to: '/log', label: 'Log a Visit', icon: Plus, primary: true },
  { to: '/plan', label: 'Plan a Night', icon: CalendarHeart },
  { to: '/profile', label: 'Profile', icon: User },
]
