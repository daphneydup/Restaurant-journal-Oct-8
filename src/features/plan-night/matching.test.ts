import { describe, expect, it } from 'vitest'
import { buildSpots, type Spot } from '@/features/restaurants/spots'
import { createTestRepositories } from '@/test/testRepositories'
import type { PriceTier, Restaurant, Visit, WorkedForEveryone } from '@/types'
import { planNight } from './matching'

type Ratings = Record<string, 1 | 2 | 3 | 4 | 5>

let counter = 0
function visit(
  restaurantId: string,
  ratings: Ratings,
  worked: WorkedForEveryone = 'yes',
  date = '2026-09-01',
): Visit {
  counter += 1
  return {
    id: `v${counter}`,
    restaurantId,
    date,
    ratings: Object.entries(ratings).map(([lensId, rating]) => ({ lensId, rating })),
    workedForEveryone: worked,
    priceTier: 2,
    companions: [],
    photoUrls: [],
    createdAt: `${date}T12:00:00.000Z`,
  }
}

function spotOf(name: string, priceTier: PriceTier, visits: Visit[] = []): Spot {
  const id = name.toLowerCase().replace(/\W+/g, '-')
  const restaurant: Restaurant = {
    id,
    name,
    neighborhood: 'Uptown',
    city: 'Dallas',
    priceTier,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  return buildSpots(
    [restaurant],
    visits.map((v) => ({ ...v, restaurantId: id })),
    [],
  )[0]!
}

const names = (list: { spot: Spot }[]) => list.map((m) => m.spot.restaurant.name)
const plan = (spots: Spot[], lensIds: string[], maxPriceTier: PriceTier = 4) =>
  planNight(spots, { lensIds, maxPriceTier })

describe('planNight: who qualifies', () => {
  it('needs a rating for every chosen diet at or above the 3.5 bar', () => {
    const spots = [
      spotOf('Great', 2, [visit('x', { vegan: 5, steak: 4 })]),
      spotOf('Weak Steak', 2, [visit('x', { vegan: 5, steak: 3 })]),
      spotOf('Weak Vegan', 2, [visit('x', { vegan: 2, steak: 5 })]),
    ]
    expect(names(plan(spots, ['vegan', 'steak']).matches)).toEqual(['Great'])
  })

  it('treats exactly 3.5 as good enough, and just under as not', () => {
    const edge = spotOf('Edge', 2, [visit('x', { vegan: 3 }), visit('x', { vegan: 4 })]) // avg 3.5
    const under = spotOf('Under', 2, [
      visit('x', { vegan: 3 }),
      visit('x', { vegan: 3 }),
      visit('x', { vegan: 5 }),
    ]) // 3.67
    const below = spotOf('Below', 2, [
      visit('x', { vegan: 3 }),
      visit('x', { vegan: 3 }),
      visit('x', { vegan: 4 }),
    ]) // 3.33
    expect(names(plan([edge, under, below], ['vegan']).matches).sort()).toEqual(['Edge', 'Under'])
  })

  it('averages across visits, so one great visit does not hide a bad one', () => {
    const spots = [
      spotOf('Inconsistent', 2, [
        visit('x', { vegan: 5 }),
        visit('x', { vegan: 1 }),
        visit('x', { vegan: 3 }),
      ]),
    ]
    expect(plan(spots, ['vegan']).matches).toEqual([]) // avg 3
  })

  it('works with a single diet', () => {
    const spots = [
      spotOf('A', 1, [visit('x', { vegan: 4 })]),
      spotOf('B', 1, [visit('x', { steak: 5 })]),
    ]
    expect(names(plan(spots, ['vegan']).matches)).toEqual(['A'])
  })

  it('ignores ratings for diets that were not chosen', () => {
    const spots = [spotOf('Vegan Gem', 1, [visit('x', { vegan: 5, steak: 1 })])]
    expect(names(plan(spots, ['vegan']).matches)).toEqual(['Vegan Gem'])
    expect(plan(spots, ['vegan', 'steak']).matches).toEqual([])
  })

  it('returns nothing when no diet is chosen', () => {
    const spots = [spotOf('A', 1, [visit('x', { vegan: 5 })])]
    expect(plan(spots, [])).toEqual({ matches: [], needsData: [] })
  })

  it('never matches a restaurant with no visits', () => {
    expect(plan([spotOf('Untried', 1)], ['vegan'])).toEqual({ matches: [], needsData: [] })
  })
})

describe('planNight: budget', () => {
  const spots = [
    spotOf('Cheap', 1, [visit('x', { vegan: 5 })]),
    spotOf('Middle', 2, [visit('x', { vegan: 5 })]),
    spotOf('Pricey', 3, [visit('x', { vegan: 5 })]),
    spotOf('Splurge', 4, [visit('x', { vegan: 5 })]),
  ]

  it.each([
    [1, ['Cheap']],
    [2, ['Cheap', 'Middle']],
    [3, ['Cheap', 'Middle', 'Pricey']],
    [4, ['Cheap', 'Middle', 'Pricey', 'Splurge']],
  ] as const)('up to tier %i keeps %j', (max, expected) => {
    expect(names(plan(spots, ['vegan'], max).matches).sort()).toEqual([...expected].sort())
  })

  it('also applies to the needs-data group', () => {
    const partial = [spotOf('Pricey', 4, [visit('x', { vegan: 5 })])]
    expect(plan(partial, ['vegan', 'steak'], 3).needsData).toEqual([])
    expect(plan(partial, ['vegan', 'steak'], 4).needsData).toHaveLength(1)
  })
})

describe('planNight: ranking', () => {
  it('ranks by the weakest chosen diet first, even when another spot has the higher overall mean', () => {
    const spots = [
      // vegan avg 5, steak avg 3.5: weakest 3.5, overall 4.25
      spotOf('Lopsided', 2, [
        visit('x', { vegan: 5, steak: 3 }),
        visit('x', { vegan: 5, steak: 4 }),
      ]),
      // vegan 4, steak 4: weakest 4, overall 4
      spotOf('Balanced', 2, [visit('x', { vegan: 4, steak: 4 })]),
    ]
    expect(names(plan(spots, ['vegan', 'steak']).matches)).toEqual(['Balanced', 'Lopsided'])
  })

  it('breaks ties on how often it worked for everyone', () => {
    // Names are chosen so the alphabetical fallback would give the opposite order.
    const spots = [
      spotOf('A Sometimes', 2, [visit('x', { vegan: 4 }, 'yes'), visit('x', { vegan: 4 }, 'no')]),
      spotOf('Z Always', 2, [visit('x', { vegan: 4 }, 'yes'), visit('x', { vegan: 4 }, 'yes')]),
    ]
    expect(names(plan(spots, ['vegan']).matches)).toEqual(['Z Always', 'A Sometimes'])
  })

  it('then on the mean of the chosen diets', () => {
    const spots = [
      spotOf('Mean 4', 2, [visit('x', { vegan: 4, steak: 4 })]),
      spotOf('Mean 4.5', 2, [visit('x', { vegan: 4, steak: 5 })]), // same weakest (4), higher mean
    ]
    expect(names(plan(spots, ['vegan', 'steak']).matches)).toEqual(['Mean 4.5', 'Mean 4'])
  })

  it('then on the most recent visit', () => {
    const spots = [
      spotOf('Old', 2, [visit('x', { vegan: 4 }, 'yes', '2026-01-01')]),
      spotOf('Recent', 2, [visit('x', { vegan: 4 }, 'yes', '2026-09-01')]),
    ]
    expect(names(plan(spots, ['vegan']).matches)).toEqual(['Recent', 'Old'])
  })

  it('finally on name, so the order is always the same', () => {
    const make = (name: string) => spotOf(name, 2, [visit('x', { vegan: 4 }, 'yes', '2026-05-05')])
    const forward = names(plan([make('Beta'), make('Alpha'), make('Gamma')], ['vegan']).matches)
    const reversed = names(plan([make('Gamma'), make('Alpha'), make('Beta')], ['vegan']).matches)
    expect(forward).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(reversed).toEqual(forward)
  })

  it('reports the numbers behind each match', () => {
    const [match] = plan(
      [
        spotOf('Num', 2, [
          visit('x', { vegan: 5, steak: 3 }, 'yes'),
          visit('x', { vegan: 4, steak: 4 }, 'no'),
        ]),
      ],
      ['vegan', 'steak'],
    ).matches
    expect(match!.lensResults).toEqual([
      { lensId: 'vegan', average: 4.5, count: 2 },
      { lensId: 'steak', average: 3.5, count: 2 },
    ])
    expect(match!.weakest).toBe(3.5)
    expect(match!.overall).toBe(4)
    expect(match!.workedYesShare).toBe(0.5)
  })

  it('does not change its input', () => {
    const spots = [
      spotOf('B', 2, [visit('x', { vegan: 4 })]),
      spotOf('A', 2, [visit('x', { vegan: 5 })]),
    ]
    const before = names(spots.map((spot) => ({ spot })))
    plan(spots, ['vegan'])
    expect(names(spots.map((spot) => ({ spot })))).toEqual(before)
  })
})

describe('planNight: needs more data', () => {
  it('lists spots where a chosen diet has never been rated (and the rated ones are fine)', () => {
    const spots = [spotOf('Half Known', 2, [visit('x', { vegan: 5 })])]
    const { matches, needsData } = plan(spots, ['vegan', 'steak'])
    expect(matches).toEqual([])
    expect(needsData).toHaveLength(1)
    expect(needsData[0]!.missingLensIds).toEqual(['steak'])
    expect(needsData[0]!.rated.map((r) => r.lensId)).toEqual(['vegan'])
  })

  it('leaves out spots where a rated diet already falls short', () => {
    const spots = [spotOf('Bad Vegan', 2, [visit('x', { vegan: 2 })])]
    expect(plan(spots, ['vegan', 'steak'])).toEqual({ matches: [], needsData: [] })
  })

  it('leaves out spots we know nothing about for the chosen diets', () => {
    const spots = [spotOf('Gluten Only', 2, [visit('x', { 'gluten-free': 5 })])]
    expect(plan(spots, ['vegan', 'steak'])).toEqual({ matches: [], needsData: [] })
  })

  it('orders by the strongest evidence, then name', () => {
    const spots = [
      spotOf('B', 2, [visit('x', { vegan: 4 })]),
      spotOf('A', 2, [visit('x', { vegan: 4 })]),
      spotOf('C', 2, [visit('x', { vegan: 5 })]),
    ]
    expect(names(plan(spots, ['vegan', 'steak']).needsData)).toEqual(['C', 'A', 'B'])
  })

  it('never puts a fully rated spot in both groups', () => {
    const spots = [spotOf('Full', 2, [visit('x', { vegan: 5, steak: 5 })])]
    const { matches, needsData } = plan(spots, ['vegan', 'steak'])
    expect(matches).toHaveLength(1)
    expect(needsData).toEqual([])
  })
})

describe('planNight with the demo data', () => {
  async function demoSpots() {
    const repos = createTestRepositories()
    return buildSpots(
      await repos.restaurants.list(),
      await repos.visits.list(),
      await repos.goBack.list(),
    )
  }

  it('Summer’s default night (vegan + steak, any budget) ranks the four spots that work for both', async () => {
    const result = planNight(await demoSpots(), { lensIds: ['vegan', 'steak'], maxPriceTier: 4 })
    expect(names(result.matches)).toEqual([
      'The Copper Table',
      'Ember & Orchard',
      'Smokestack Sprout',
      'Marigold Social',
    ])
  })

  it('a budget of $$ leaves the cheaper two', async () => {
    const result = planNight(await demoSpots(), { lensIds: ['vegan', 'steak'], maxPriceTier: 2 })
    expect(names(result.matches)).toEqual(['Smokestack Sprout', 'Marigold Social'])
  })

  it('adding gluten-free narrows to the spots that have rated it well, and flags the rest as unknown', async () => {
    const result = planNight(await demoSpots(), {
      lensIds: ['vegan', 'steak', 'gluten-free'],
      maxPriceTier: 4,
    })
    expect(names(result.matches)).toEqual(['The Copper Table', 'Ember & Orchard'])
    expect(names(result.needsData)).toEqual(['Smokestack Sprout', 'Marigold Social'])
  })

  it('vegan + vegetarian surfaces vegetarian-friendly spots', async () => {
    const result = planNight(await demoSpots(), {
      lensIds: ['vegan', 'vegetarian'],
      maxPriceTier: 4,
    })
    expect(names(result.matches)).toContain('Saffron & Salt')
    expect(names(result.matches)).not.toContain('Cinder House')
  })
})
