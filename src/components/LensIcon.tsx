import {
  Beef,
  Fish,
  Leaf,
  MilkOff,
  Sprout,
  Utensils,
  WheatOff,
  type LucideIcon,
} from 'lucide-react'

/** Maps a DietLens `icon` key (plain data) to a component. Unknown keys fall back to a utensil. */
const ICONS: Record<string, LucideIcon> = {
  leaf: Leaf,
  sprout: Sprout,
  beef: Beef,
  'wheat-off': WheatOff,
  'milk-off': MilkOff,
  fish: Fish,
}

export function LensIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Utensils
  return <Icon aria-hidden className={className ?? 'size-4'} />
}
