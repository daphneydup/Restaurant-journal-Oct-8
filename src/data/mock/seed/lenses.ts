import type { DietLens } from '@/types'

/** Default dietary lenses. `icon` is a key the UI maps to an icon component. */
export const DEFAULT_LENSES: DietLens[] = [
  {
    id: 'vegan',
    label: 'Vegan options',
    shortLabel: 'Vegan',
    icon: 'leaf',
    kind: 'restriction',
    sortOrder: 1,
  },
  {
    id: 'vegetarian',
    label: 'Vegetarian options',
    shortLabel: 'Vegetarian',
    icon: 'sprout',
    kind: 'restriction',
    sortOrder: 2,
  },
  {
    id: 'steak',
    label: 'Steak / meat',
    shortLabel: 'Steak',
    icon: 'beef',
    kind: 'preference',
    sortOrder: 3,
  },
  {
    id: 'gluten-free',
    label: 'Gluten-free',
    shortLabel: 'Gluten-free',
    icon: 'wheat-off',
    kind: 'restriction',
    sortOrder: 4,
  },
  {
    id: 'dairy-free',
    label: 'Dairy-free',
    shortLabel: 'Dairy-free',
    icon: 'milk-off',
    kind: 'restriction',
    sortOrder: 5,
  },
  {
    id: 'pescatarian',
    label: 'Pescatarian',
    shortLabel: 'Pescatarian',
    icon: 'fish',
    kind: 'preference',
    sortOrder: 6,
  },
]
