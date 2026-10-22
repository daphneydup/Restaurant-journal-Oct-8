import type { Reward } from '@/types'

/**
 * The sample perk catalogue. Partners are fictional and nothing here is honoured by a real
 * restaurant yet: it shows how the programme works. The ids and costs match the `rewards_catalog`
 * seed in the Supabase migration, so the two data layers offer the same perks.
 */
export const REWARD_CATALOG: readonly Reward[] = [
  {
    id: 'appetizer-ember',
    title: 'Complimentary appetizer',
    description: 'Any starter from the seasonal menu, with your main course.',
    partner: 'Ember & Orchard',
    category: 'appetizer',
    cost: 150,
  },
  {
    id: 'drink-marigold',
    title: 'Signature cocktail or mocktail',
    description: 'One house drink on us, alcoholic or not.',
    partner: 'Marigold Social',
    category: 'drink',
    cost: 120,
  },
  {
    id: 'dessert-fig',
    title: 'Dessert to share',
    description: 'The pastry chef’s dessert of the evening, for the whole table.',
    partner: 'Little Fig Kitchen',
    category: 'dessert',
    cost: 180,
  },
  {
    id: 'discount-basil',
    title: '$15 off your table',
    description: 'Taken off the bill on dinner for two or more.',
    partner: 'Basil & Bone',
    category: 'discount',
    cost: 250,
  },
  {
    id: 'discount-saffron',
    title: '20% off dinner',
    description: 'Twenty percent off the food on a weekday evening.',
    partner: 'Saffron & Salt',
    category: 'discount',
    cost: 400,
  },
  {
    id: 'entree-cinder',
    title: 'Complimentary entrée',
    description: 'A main course of your choice when a second is ordered.',
    partner: 'Cinder House',
    category: 'entree',
    cost: 500,
  },
  {
    id: 'bottle-lantern',
    title: 'Bottle of sparkling',
    description: 'A bottle of the house sparkling wine to start the evening.',
    partner: 'Lantern Alley',
    category: 'drink',
    cost: 800,
  },
  {
    id: 'tasting-copper',
    title: 'Chef’s tasting for two',
    description: 'The full tasting menu for two at the chef’s counter.',
    partner: 'The Copper Table',
    category: 'experience',
    cost: 1500,
  },
]
