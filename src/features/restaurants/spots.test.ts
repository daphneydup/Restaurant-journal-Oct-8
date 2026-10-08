import { beforeEach, describe, expect, it } from 'vitest'
import { createTestRepositories } from '@/test/testRepositories'
import {
  buildSpots,
  countActiveFilters,
  EMPTY_FILTERS,
  filterSpots,
  parseFilters,
  serializeFilters,
  sortSpots,
  type Spot,
  type SpotFilters,
} from './spots'

let spots: Spot[]

beforeEach(async () => {
  const repos = createTestRepositories()
  spots = buildSpots(
    await repos.restaurants.list(),
    await repos.visits.list(),
    await repos.goBack.list(),
  )
})

const names = (list: readonly Spot[]) => list.map((s) => s.restaurant.name)
const filters = (overrides: Partial<SpotFilters>): SpotFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
})

describe('buildSpots', () => {
  const byId = (id: string) => spots.find((s) => s.restaurant.id === id)!

  it('has one spot per restaurant', () => {
    expect(spots).toHaveLength(10)
  })

  it('attaches visits newest first, diet stats and the last visit date', () => {
    const ember = byId('r-ember')
    expect(ember.visits.map((v) => v.id)).toEqual(['v-ember-1', 'v-ember-2', 'v-ember-3'])
    expect(ember.lastVisitDate).toBe(ember.visits[0]!.date)
    const vegan = ember.stats.find((s) => s.lensId === 'vegan')!
    expect(vegan.count).toBe(3)
    expect(vegan.average).toBeCloseTo((5 + 4 + 4) / 3)
  })

  it('handles a spot that has never been visited', () => {
    const lantern = byId('r-lantern')
    expect(lantern.visits).toEqual([])
    expect(lantern.stats).toEqual([])
    expect(lantern.lastVisitDate).toBeNull()
    expect(lantern.goBack).not.toBeNull()
  })

  it('links the go-back entry', () => {
    expect(byId('r-fig').goBack?.note).toMatch(/kofta/)
    expect(byId('r-noodle').goBack).toBeNull()
  })
})

describe('filterSpots', () => {
  it('returns everything when nothing is set', () => {
    expect(filterSpots(spots, EMPTY_FILTERS)).toHaveLength(10)
  })

  it('searches names case-insensitively and ignores surrounding space', () => {
    expect(names(filterSpots(spots, filters({ query: '  FIG ' })))).toEqual(['Little Fig Kitchen'])
    expect(filterSpots(spots, filters({ query: 'zzz' }))).toEqual([])
  })

  it('filters by price tier (any of the chosen tiers)', () => {
    const cheap = filterSpots(spots, filters({ priceTiers: [1] }))
    expect(names(cheap).sort()).toEqual(['Noodle & Nori', 'Smokestack Sprout'])
    expect(filterSpots(spots, filters({ priceTiers: [1, 4] }))).toHaveLength(3)
  })

  it('filters by neighborhood', () => {
    expect(names(filterSpots(spots, filters({ neighborhood: 'Bishop Arts' }))).sort()).toEqual([
      'Little Fig Kitchen',
      'Marigold Social',
    ])
  })

  it('filters by go-back status', () => {
    expect(names(filterSpots(spots, filters({ goBackOnly: true }))).sort()).toEqual([
      'Ember & Orchard',
      'Lantern Alley',
      'Little Fig Kitchen',
      'Saffron & Salt',
      'The Copper Table',
    ])
  })

  it('requires a spot to work for EVERY chosen diet', () => {
    const vegan = names(filterSpots(spots, filters({ lensIds: ['vegan'] })))
    expect(vegan).toEqual(expect.arrayContaining(['Saffron & Salt', 'Marigold Social']))
    expect(vegan).not.toContain('Cinder House') // vegan avg 2

    const both = names(filterSpots(spots, filters({ lensIds: ['vegan', 'steak'] }))).sort()
    expect(both).toEqual([
      'Ember & Orchard',
      'Marigold Social',
      'Smokestack Sprout',
      'The Copper Table',
    ])
  })

  it('never matches a spot with no ratings for a chosen diet', () => {
    expect(filterSpots(spots, filters({ lensIds: ['dairy-free'] }))).toEqual([])
    expect(names(filterSpots(spots, filters({ lensIds: ['vegan'] })))).not.toContain(
      'Lantern Alley',
    )
  })

  it('combines filters with AND', () => {
    const result = filterSpots(
      spots,
      filters({ lensIds: ['vegan', 'steak'], priceTiers: [1], goBackOnly: false }),
    )
    expect(names(result)).toEqual(['Smokestack Sprout'])
    expect(
      filterSpots(spots, filters({ lensIds: ['vegan', 'steak'], goBackOnly: true }))
        .map((s) => s.restaurant.id)
        .sort(),
    ).toEqual(['r-copper', 'r-ember'])
  })
})

describe('sortSpots', () => {
  it('puts the most recently visited first and never-visited last', () => {
    const sorted = sortSpots(spots)
    expect(sorted[0]!.restaurant.name).toBe('Noodle & Nori') // 3 days ago
    expect(sorted.at(-1)!.restaurant.name).toBe('Lantern Alley')
    const dates = sorted.flatMap((s) => (s.lastVisitDate ? [s.lastVisitDate] : []))
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('does not mutate its input', () => {
    const before = names(spots)
    sortSpots(spots)
    expect(names(spots)).toEqual(before)
  })
})

describe('countActiveFilters', () => {
  it('counts each chosen diet, price, neighborhood and go-back, but not the search text', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0)
    expect(countActiveFilters(filters({ query: 'x' }))).toBe(0)
    expect(
      countActiveFilters(
        filters({
          lensIds: ['vegan', 'steak'],
          priceTiers: [2],
          neighborhood: 'Uptown',
          goBackOnly: true,
        }),
      ),
    ).toBe(5)
  })
})

describe('URL round-trip', () => {
  it('serializes and parses the same filters', () => {
    const original = filters({
      query: 'fig',
      lensIds: ['vegan', 'steak'],
      priceTiers: [1, 3],
      neighborhood: 'Uptown',
      goBackOnly: true,
    })
    const params = serializeFilters(original)
    expect(params.toString()).toBe('q=fig&diet=vegan%2Csteak&price=1%2C3&hood=Uptown&goback=1')
    expect(parseFilters(params)).toEqual(original)
  })

  it('produces an empty query string for empty filters', () => {
    expect(serializeFilters(EMPTY_FILTERS).toString()).toBe('')
    expect(parseFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS)
  })

  it('ignores junk in the URL', () => {
    const parsed = parseFilters(new URLSearchParams('price=1,9,abc&diet=,,vegan&goback=yes'))
    expect(parsed.priceTiers).toEqual([1])
    expect(parsed.lensIds).toEqual(['vegan'])
    expect(parsed.goBackOnly).toBe(false)
  })
})
