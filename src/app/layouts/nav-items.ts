import {
  Bookmark,
  CalendarHeart,
  Gem,
  Plus,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Match only the exact path (needed for "/"). */
  end?: boolean
  /** Shorter text for the cramped mobile tab bar. The rest stays in the accessible name. */
  tabLabel?: string
  /** The primary action, rendered raised in the mobile tab bar. */
  primary?: boolean
  /** Left out of the mobile tab bar (five tabs is its limit); reached from My Spots and Profile. */
  desktopOnly?: boolean
}

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: 'My Spots', icon: UtensilsCrossed, end: true },
  { to: '/go-back', label: 'Go Back', icon: Bookmark },
  { to: '/log', label: 'Log a Visit', tabLabel: 'Log', icon: Plus, primary: true },
  { to: '/plan', label: 'Plan a Night', tabLabel: 'Plan', icon: CalendarHeart },
  { to: '/rewards', label: 'Rewards', icon: Gem, desktopOnly: true },
  { to: '/profile', label: 'Profile', icon: User },
]
