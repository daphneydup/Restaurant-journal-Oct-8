import { addDays, toISODate } from '@/lib/dates'
import type {
  Dish,
  DishVerdict,
  GoBackEntry,
  PriceTier,
  Restaurant,
  Visit,
  WorkedForEveryone,
} from '@/types'
import { MOCK_DB_VERSION, type MockDb } from '../db'
import { DEFAULT_LENSES } from './lenses'

type Ratings = Record<string, 1 | 2 | 3 | 4 | 5>

/**
 * Builds the demo data set. Every date is relative to `now`, so on a fresh install
 * "last visited" and "You haven't been in X weeks" look realistic. All restaurants,
 * dishes and people are fictional.
 */
export function buildDemoSeed(now: Date): MockDb {
  const ago = (days: number) => addDays(now, -days)
  const day = (days: number) => toISODate(ago(days))
  const stamp = (days: number) => `${day(days)}T18:30:00.000Z`

  const restaurant = (
    id: string,
    name: string,
    neighborhood: string,
    priceTier: PriceTier,
    cuisine: string,
    createdDaysAgo: number,
  ): Restaurant => ({
    id,
    name,
    neighborhood,
    city: 'Dallas',
    priceTier,
    cuisine,
    createdAt: stamp(createdDaysAgo),
  })

  const visit = (
    id: string,
    restaurantId: string,
    daysAgo: number,
    ratings: Ratings,
    workedForEveryone: WorkedForEveryone,
    priceTier: PriceTier,
    extra: { worthIt?: boolean; note?: string; companions?: string[] } = {},
  ): Visit => ({
    id,
    restaurantId,
    date: day(daysAgo),
    ratings: Object.entries(ratings).map(([lensId, rating]) => ({ lensId, rating })),
    workedForEveryone,
    priceTier,
    companions: extra.companions ?? [],
    photoUrls: [],
    createdAt: stamp(daysAgo),
    ...(extra.worthIt !== undefined && { worthIt: extra.worthIt }),
    ...(extra.note !== undefined && { note: extra.note }),
  })

  const dish = (
    id: string,
    restaurantId: string,
    visitId: string | undefined,
    name: string,
    verdict: DishVerdict,
    lensIds: string[],
    daysAgo: number,
  ): Dish => ({
    id,
    restaurantId,
    name,
    verdict,
    lensIds,
    createdAt: stamp(daysAgo),
    ...(visitId !== undefined && { visitId }),
  })

  const goBack = (
    id: string,
    restaurantId: string,
    daysAgo: number,
    note?: string,
  ): GoBackEntry => ({
    id,
    restaurantId,
    addedAt: stamp(daysAgo),
    ...(note !== undefined && { note }),
  })

  return {
    version: MOCK_DB_VERSION,
    lenses: DEFAULT_LENSES,
    user: {
      id: 'user-summer',
      displayName: 'Summer',
      defaultLensIds: ['vegan', 'steak'],
      homeCity: 'Dallas',
    },

    restaurants: [
      restaurant('r-ember', 'Ember & Orchard', 'Uptown', 3, 'Wood-fired American', 160),
      restaurant('r-marigold', 'Marigold Social', 'Bishop Arts', 2, 'Modern Mexican', 100),
      restaurant('r-cinder', 'Cinder House', 'Deep Ellum', 3, 'Steakhouse', 135),
      restaurant('r-fig', 'Little Fig Kitchen', 'Bishop Arts', 2, 'Mediterranean', 60),
      restaurant('r-noodle', 'Noodle & Nori', 'Deep Ellum', 1, 'Japanese noodles', 4),
      restaurant('r-copper', 'The Copper Table', 'Uptown', 4, 'Tasting menu', 212),
      restaurant('r-basil', 'Basil & Bone', 'Lower Greenville', 2, 'Italian', 105),
      restaurant('r-sprout', 'Smokestack Sprout', 'Oak Cliff', 1, 'BBQ & plant-based', 92),
      restaurant('r-saffron', 'Saffron & Salt', 'Design District', 3, 'Indian', 165),
      restaurant('r-lantern', 'Lantern Alley', 'Knox-Henderson', 2, 'Vietnamese', 14),
    ],

    visits: [
      visit('v-ember-1', 'r-ember', 12, { vegan: 5, steak: 5, 'gluten-free': 4 }, 'yes', 3, {
        worthIt: true,
        note: 'Cauliflower steak next to a dry-aged ribeye. Nobody fought over the menu.',
        companions: ['Maya', 'Dev'],
      }),
      visit('v-ember-2', 'r-ember', 70, { vegan: 4, steak: 5 }, 'yes', 3, { worthIt: true }),
      visit('v-ember-3', 'r-ember', 150, { vegan: 4, steak: 4 }, 'yes', 3),

      visit('v-marigold-1', 'r-marigold', 25, { vegan: 5, vegetarian: 5, steak: 3 }, 'yes', 2, {
        worthIt: true,
        note: 'Jackfruit tacos are the star. Steak was fine, not special.',
        companions: ['Maya'],
      }),
      visit('v-marigold-2', 'r-marigold', 95, { vegan: 5, steak: 4 }, 'yes', 2, { worthIt: true }),

      visit('v-cinder-1', 'r-cinder', 40, { steak: 5, vegan: 2, vegetarian: 2 }, 'no', 3, {
        worthIt: true,
        note: 'Unreal steak, but the vegan option was a side salad. Only go if everyone eats meat.',
        companions: ['Dev', 'Priya'],
      }),
      visit('v-cinder-2', 'r-cinder', 130, { steak: 5, vegan: 2 }, 'maybe', 3),

      visit(
        'v-fig-1',
        'r-fig',
        8,
        { vegan: 4, vegetarian: 5, 'gluten-free': 5, steak: 3 },
        'maybe',
        2,
        {
          worthIt: true,
          note: 'Great mezze spread. The lamb kofta saved the meat lover.',
          companions: ['Priya'],
        },
      ),
      visit('v-fig-2', 'r-fig', 55, { vegetarian: 5, 'gluten-free': 4, steak: 3 }, 'maybe', 2),

      visit('v-noodle-1', 'r-noodle', 3, { vegan: 4, steak: 2 }, 'maybe', 1, {
        worthIt: true,
        note: 'Quick weeknight bowl. Miso mushroom ramen is the move.',
      }),

      visit('v-copper-1', 'r-copper', 210, { vegan: 5, steak: 5, 'gluten-free': 5 }, 'yes', 4, {
        worthIt: true,
        note: 'Stunning tasting menu with a full vegan track. Save it for a birthday.',
        companions: ['Maya', 'Dev', 'Priya'],
      }),

      visit(
        'v-basil-1',
        'r-basil',
        33,
        { vegetarian: 5, 'gluten-free': 4, steak: 4, vegan: 3 },
        'maybe',
        2,
        {
          worthIt: true,
        },
      ),
      visit('v-basil-2', 'r-basil', 100, { vegetarian: 4, steak: 4 }, 'yes', 2),

      visit('v-sprout-1', 'r-sprout', 18, { vegan: 4, steak: 5 }, 'yes', 1, {
        worthIt: true,
        note: 'Smoked jackfruit sandwich and a brisket plate. Cheap and loud.',
        companions: ['Dev'],
      }),
      visit('v-sprout-2', 'r-sprout', 48, { vegan: 4, steak: 5 }, 'yes', 1, { worthIt: true }),
      visit('v-sprout-3', 'r-sprout', 90, { vegan: 3, steak: 5 }, 'maybe', 1),

      visit(
        'v-saffron-1',
        'r-saffron',
        60,
        { vegan: 5, vegetarian: 5, 'gluten-free': 4, steak: 2 },
        'maybe',
        3,
        {
          worthIt: true,
          note: 'Best vegan curry in town. Not the place for a steak craving.',
          companions: ['Priya'],
        },
      ),
      visit('v-saffron-2', 'r-saffron', 160, { vegan: 5, vegetarian: 5, steak: 2 }, 'maybe', 3),
    ],

    dishes: [
      dish(
        'd-1',
        'r-ember',
        'v-ember-1',
        'Charred cauliflower steak',
        'order-again',
        ['vegan', 'vegetarian', 'gluten-free'],
        12,
      ),
      dish(
        'd-2',
        'r-ember',
        'v-ember-1',
        '12oz dry-aged ribeye',
        'order-again',
        ['steak', 'gluten-free'],
        12,
      ),
      dish('d-3', 'r-ember', 'v-ember-2', 'Burnt-honey flatbread', 'skip', ['vegetarian'], 70),
      dish(
        'd-4',
        'r-marigold',
        'v-marigold-1',
        'Jackfruit al pastor tacos',
        'order-again',
        ['vegan', 'vegetarian'],
        25,
      ),
      dish('d-5', 'r-marigold', 'v-marigold-1', 'Carne asada plate', 'order-again', ['steak'], 25),
      dish('d-6', 'r-marigold', 'v-marigold-2', 'Queso fundido', 'skip', ['vegetarian'], 95),
      dish('d-7', 'r-cinder', 'v-cinder-1', 'Bone-in strip', 'order-again', ['steak'], 40),
      dish('d-8', 'r-cinder', 'v-cinder-1', 'Side salad (the vegan option)', 'skip', ['vegan'], 40),
      dish(
        'd-9',
        'r-fig',
        'v-fig-1',
        'Whipped hummus & za’atar pita',
        'order-again',
        ['vegan', 'vegetarian'],
        8,
      ),
      dish('d-10', 'r-fig', 'v-fig-1', 'Lamb kofta', 'order-again', ['steak', 'gluten-free'], 8),
      dish('d-11', 'r-fig', 'v-fig-2', 'Spinach pie', 'skip', ['vegetarian'], 55),
      dish('d-12', 'r-noodle', 'v-noodle-1', 'Miso mushroom ramen', 'order-again', ['vegan'], 3),
      dish(
        'd-13',
        'r-basil',
        'v-basil-1',
        'Wild mushroom risotto',
        'order-again',
        ['vegetarian', 'gluten-free'],
        33,
      ),
      dish('d-14', 'r-basil', 'v-basil-1', 'Bistecca for two', 'order-again', ['steak'], 33),
      dish(
        'd-15',
        'r-sprout',
        'v-sprout-1',
        'Smoked jackfruit sandwich',
        'order-again',
        ['vegan'],
        18,
      ),
      dish('d-16', 'r-sprout', 'v-sprout-1', 'Brisket plate', 'order-again', ['steak'], 18),
      dish('d-17', 'r-sprout', 'v-sprout-2', 'Mac & cheese', 'skip', ['vegetarian'], 48),
      dish(
        'd-18',
        'r-saffron',
        'v-saffron-1',
        'Chana masala',
        'order-again',
        ['vegan', 'vegetarian', 'gluten-free'],
        60,
      ),
      dish('d-19', 'r-saffron', 'v-saffron-1', 'Lamb vindaloo', 'skip', ['steak'], 60),
      dish(
        'd-20',
        'r-copper',
        'v-copper-1',
        'Seven-course vegan tasting',
        'order-again',
        ['vegan'],
        210,
      ),
    ],

    goBackEntries: [
      goBack('g-1', 'r-fig', 5, 'Try the lamb kofta again with the group.'),
      goBack('g-2', 'r-lantern', 14, 'Heard the vegan pho is great.'),
      goBack('g-3', 'r-ember', 20, 'Seasonal tasting board.'),
      goBack('g-4', 'r-saffron', 50),
      goBack('g-5', 'r-copper', 200, 'Birthday dinner?'),
    ],
  }
}
