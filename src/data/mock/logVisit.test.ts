import { beforeEach, describe, expect, it } from 'vitest'
import { createTestRepositories, TEST_NOW } from '@/test/testRepositories'
import type { LogVisitInput } from '@/types'
import type { Repositories } from '../repositories'

let repos: Repositories

beforeEach(() => {
  repos = createTestRepositories()
})

const visitDetails: LogVisitInput['visit'] = {
  date: '2026-10-07',
  ratings: [
    { lensId: 'vegan', rating: 5 },
    { lensId: 'steak', rating: 4 },
  ],
  workedForEveryone: 'yes',
  priceTier: 3,
  companions: ['Maya'],
  photoUrls: [],
}

const existing = (restaurantId: string, overrides: Partial<LogVisitInput> = {}): LogVisitInput => ({
  restaurant: { mode: 'existing', restaurantId },
  visit: visitDetails,
  dishes: [],
  addToGoBack: false,
  ...overrides,
})

const brandNew = (overrides: Partial<LogVisitInput> = {}): LogVisitInput => ({
  restaurant: { mode: 'new', name: 'Fresh Plate', neighborhood: 'Uptown', city: 'Dallas' },
  visit: visitDetails,
  dishes: [],
  addToGoBack: false,
  ...overrides,
})

async function snapshot() {
  return {
    restaurants: await repos.restaurants.list(),
    visits: await repos.visits.list(),
    dishes: await repos.dishes.list(),
    goBack: await repos.goBack.list(),
  }
}

describe('VisitRepository.logVisit', () => {
  it('logs a visit for an existing restaurant', async () => {
    const before = await snapshot()
    const result = await repos.visits.logVisit(existing('r-fig'))

    expect(result.createdRestaurant).toBe(false)
    expect(result.restaurant.id).toBe('r-fig')
    expect(result.visit).toMatchObject({
      restaurantId: 'r-fig',
      date: '2026-10-07',
      workedForEveryone: 'yes',
      createdAt: TEST_NOW.toISOString(),
    })

    const after = await snapshot()
    expect(after.restaurants).toEqual(before.restaurants)
    expect(after.visits).toHaveLength(before.visits.length + 1)
    expect(await repos.visits.getById(result.visit.id)).toEqual(result.visit)
  })

  it('creates a new restaurant that takes its price tier from the visit', async () => {
    const result = await repos.visits.logVisit(brandNew())

    expect(result.createdRestaurant).toBe(true)
    expect(result.restaurant).toMatchObject({
      name: 'Fresh Plate',
      neighborhood: 'Uptown',
      city: 'Dallas',
      priceTier: 3,
    })
    expect(await repos.restaurants.getById(result.restaurant.id)).toEqual(result.restaurant)
    expect(result.visit.restaurantId).toBe(result.restaurant.id)
  })

  it('saves dishes linked to both the restaurant and the visit', async () => {
    const result = await repos.visits.logVisit(
      existing('r-noodle', {
        dishes: [
          { name: 'Gyoza', verdict: 'skip', lensIds: ['vegetarian'] },
          { name: 'Miso ramen', verdict: 'order-again', lensIds: ['vegan'] },
        ],
      }),
    )

    expect(result.dishes).toHaveLength(2)
    for (const dish of result.dishes) {
      expect(dish).toMatchObject({ restaurantId: 'r-noodle', visitId: result.visit.id })
    }
    const stored = await repos.dishes.listByRestaurant('r-noodle')
    expect(stored.filter((d) => d.visitId === result.visit.id)).toHaveLength(2)
  })

  it('adds the restaurant to the go-back list when asked, once', async () => {
    await repos.visits.logVisit(existing('r-noodle', { addToGoBack: true }))
    expect(await repos.goBack.getByRestaurantId('r-noodle')).not.toBeNull()

    // Already flagged (r-fig is in the seed): no conflict, no duplicate.
    const before = (await repos.goBack.list()).length
    await expect(
      repos.visits.logVisit(existing('r-fig', { addToGoBack: true })),
    ).resolves.toBeDefined()
    expect(await repos.goBack.list()).toHaveLength(before)
  })

  it('does not touch the go-back list when not asked', async () => {
    await repos.visits.logVisit(existing('r-noodle'))
    expect(await repos.goBack.getByRestaurantId('r-noodle')).toBeNull()
  })

  it('rejects a "new" restaurant that already exists, saving nothing', async () => {
    const before = await snapshot()
    await expect(
      repos.visits.logVisit(
        brandNew({
          restaurant: {
            mode: 'new',
            name: 'noodle & nori',
            neighborhood: 'DEEP ELLUM',
            city: 'Dallas',
          },
        }),
      ),
    ).rejects.toMatchObject({ code: 'conflict' })
    expect(await snapshot()).toEqual(before)
  })

  it('rejects an unknown existing restaurant, saving nothing', async () => {
    const before = await snapshot()
    await expect(repos.visits.logVisit(existing('ghost'))).rejects.toMatchObject({
      code: 'invalid_reference',
    })
    expect(await snapshot()).toEqual(before)
  })

  it('is atomic: a bad dish lens means the new restaurant and visit are not saved either', async () => {
    const before = await snapshot()
    await expect(
      repos.visits.logVisit(
        brandNew({
          dishes: [{ name: 'Mystery', verdict: 'order-again', lensIds: ['keto'] }],
          addToGoBack: true,
        }),
      ),
    ).rejects.toMatchObject({ code: 'invalid_reference' })
    expect(await snapshot()).toEqual(before)
  })

  it('is atomic: a bad rating lens saves nothing', async () => {
    const before = await snapshot()
    await expect(
      repos.visits.logVisit(
        brandNew({ visit: { ...visitDetails, ratings: [{ lensId: 'keto', rating: 3 }] } }),
      ),
    ).rejects.toMatchObject({ code: 'invalid_reference' })
    expect(await snapshot()).toEqual(before)
  })

  it('validates the input shape (no ratings, blank name)', async () => {
    await expect(
      repos.visits.logVisit(existing('r-fig', { visit: { ...visitDetails, ratings: [] } })),
    ).rejects.toMatchObject({
      code: 'validation',
    })
    await expect(
      repos.visits.logVisit(
        brandNew({
          restaurant: { mode: 'new', name: ' ', neighborhood: 'Uptown', city: 'Dallas' },
        }),
      ),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('a second visit to the restaurant it just created works (no duplicate conflict)', async () => {
    const first = await repos.visits.logVisit(brandNew())
    const second = await repos.visits.logVisit(existing(first.restaurant.id))
    expect(second.visit.restaurantId).toBe(first.restaurant.id)
  })
})
