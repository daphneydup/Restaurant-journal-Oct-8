import { beforeEach, describe, expect, it } from 'vitest'
import type { Repositories } from '../repositories'
import { createTestRepositories, TEST_NOW } from '@/test/testRepositories'
import type { RestaurantInput, VisitInput } from '@/types'

let repos: Repositories

beforeEach(() => {
  repos = createTestRepositories()
})

const newRestaurant: RestaurantInput = {
  name: 'Test Kitchen',
  neighborhood: 'Deep Ellum',
  city: 'Dallas',
  priceTier: 2,
}

const newVisit = (restaurantId: string, overrides: Partial<VisitInput> = {}): VisitInput => ({
  restaurantId,
  date: '2026-10-07',
  ratings: [{ lensId: 'vegan', rating: 4 }],
  workedForEveryone: 'yes',
  priceTier: 2,
  companions: [],
  photoUrls: [],
  ...overrides,
})

describe('RestaurantRepository', () => {
  it('lists restaurants A to Z', async () => {
    const names = (await repos.restaurants.list()).map((r) => r.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  it('getById returns the restaurant, or null when missing', async () => {
    const [first] = await repos.restaurants.list()
    expect(await repos.restaurants.getById(first!.id)).toEqual(first)
    expect(await repos.restaurants.getById('nope')).toBeNull()
  })

  it('create assigns an id and createdAt, trims text, and persists', async () => {
    const created = await repos.restaurants.create({ ...newRestaurant, name: '  Test Kitchen ' })
    expect(created).toMatchObject({
      id: 'test-id-1',
      name: 'Test Kitchen',
      createdAt: TEST_NOW.toISOString(),
    })
    expect(await repos.restaurants.getById(created.id)).toEqual(created)
  })

  it('create rejects invalid input with a validation error', async () => {
    await expect(repos.restaurants.create({ ...newRestaurant, name: '' })).rejects.toMatchObject({
      code: 'validation',
    })
    await expect(
      repos.restaurants.create({ ...newRestaurant, priceTier: 7 as never }),
    ).rejects.toMatchObject({ code: 'validation' })
  })

  it('create rejects a duplicate name + neighborhood (case-insensitive) with conflict', async () => {
    await repos.restaurants.create(newRestaurant)
    await expect(
      repos.restaurants.create({
        ...newRestaurant,
        name: 'TEST KITCHEN',
        neighborhood: 'deep ellum',
      }),
    ).rejects.toMatchObject({ code: 'conflict' })
    // Same name in another neighborhood is a different place.
    await expect(
      repos.restaurants.create({ ...newRestaurant, neighborhood: 'Uptown' }),
    ).resolves.toBeDefined()
  })

  it('update merges a patch, keeps id and createdAt, and validates the result', async () => {
    const created = await repos.restaurants.create(newRestaurant)
    const updated = await repos.restaurants.update(created.id, { priceTier: 4, cuisine: 'Fusion' })
    expect(updated).toEqual({ ...created, priceTier: 4, cuisine: 'Fusion' })

    await expect(repos.restaurants.update(created.id, { name: '' })).rejects.toMatchObject({
      code: 'validation',
    })
    expect(await repos.restaurants.getById(created.id)).toEqual(updated)
  })

  it('update rejects unknown ids, and renames that would collide', async () => {
    await expect(repos.restaurants.update('nope', { priceTier: 1 })).rejects.toMatchObject({
      code: 'not_found',
    })
    const a = await repos.restaurants.create(newRestaurant)
    await repos.restaurants.create({ ...newRestaurant, name: 'Other Kitchen' })
    await expect(repos.restaurants.update(a.id, { name: 'Other Kitchen' })).rejects.toMatchObject({
      code: 'conflict',
    })
    // Re-saving a restaurant with its own name is not a conflict.
    await expect(repos.restaurants.update(a.id, { name: 'Test Kitchen' })).resolves.toBeDefined()
  })

  it('remove deletes the restaurant and cascades to visits, dishes and go-back', async () => {
    const restaurant = await repos.restaurants.create(newRestaurant)
    const visit = await repos.visits.create(newVisit(restaurant.id))
    await repos.dishes.create({
      restaurantId: restaurant.id,
      visitId: visit.id,
      name: 'Tacos',
      verdict: 'order-again',
      lensIds: ['vegan'],
    })
    await repos.goBack.create({ restaurantId: restaurant.id })

    await repos.restaurants.remove(restaurant.id)

    expect(await repos.restaurants.getById(restaurant.id)).toBeNull()
    expect(await repos.visits.listByRestaurant(restaurant.id)).toEqual([])
    expect(await repos.dishes.listByRestaurant(restaurant.id)).toEqual([])
    expect(await repos.goBack.getByRestaurantId(restaurant.id)).toBeNull()
  })

  it('remove leaves other restaurants alone and rejects unknown ids', async () => {
    const before = await repos.restaurants.list()
    const [first, ...rest] = before
    await repos.restaurants.remove(first!.id)
    expect(await repos.restaurants.list()).toEqual(rest)
    await expect(repos.restaurants.remove('nope')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('returns copies, so mutating a result never changes the store', async () => {
    const [first] = await repos.restaurants.list()
    first!.name = 'HACKED'
    expect((await repos.restaurants.getById(first!.id))?.name).not.toBe('HACKED')
  })
})

describe('VisitRepository', () => {
  it('lists visits newest first and filters by restaurant', async () => {
    const all = await repos.visits.list()
    const dates = all.map((v) => v.date)
    expect(dates).toEqual([...dates].sort().reverse())

    const forEmber = await repos.visits.listByRestaurant('r-ember')
    expect(forEmber.length).toBe(3)
    expect(forEmber.every((v) => v.restaurantId === 'r-ember')).toBe(true)
    expect(await repos.visits.listByRestaurant('r-lantern')).toEqual([])
  })

  it('create stores a valid visit', async () => {
    const visit = await repos.visits.create(
      newVisit('r-fig', { note: 'Great hummus', worthIt: true }),
    )
    expect(visit).toMatchObject({ id: 'test-id-1', restaurantId: 'r-fig', note: 'Great hummus' })
    expect(await repos.visits.getById(visit.id)).toEqual(visit)
  })

  it('create rejects an unknown restaurant or unknown lens with invalid_reference', async () => {
    await expect(repos.visits.create(newVisit('ghost'))).rejects.toMatchObject({
      code: 'invalid_reference',
    })
    await expect(
      repos.visits.create(newVisit('r-fig', { ratings: [{ lensId: 'keto', rating: 3 }] })),
    ).rejects.toMatchObject({ code: 'invalid_reference' })
  })

  it('create rejects schema-invalid visits (no ratings, duplicate lenses, bad date)', async () => {
    await expect(repos.visits.create(newVisit('r-fig', { ratings: [] }))).rejects.toMatchObject({
      code: 'validation',
    })
    await expect(
      repos.visits.create(
        newVisit('r-fig', {
          ratings: [
            { lensId: 'vegan', rating: 3 },
            { lensId: 'vegan', rating: 4 },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'validation' })
    await expect(
      repos.visits.create(newVisit('r-fig', { date: '2026-13-01' })),
    ).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('update patches fields; remove deletes the visit and its dishes only', async () => {
    const updated = await repos.visits.update('v-fig-1', { workedForEveryone: 'yes' })
    expect(updated.workedForEveryone).toBe('yes')

    const dishesBefore = await repos.dishes.listByRestaurant('r-fig')
    expect(dishesBefore.some((d) => d.visitId === 'v-fig-1')).toBe(true)

    await repos.visits.remove('v-fig-1')
    expect(await repos.visits.getById('v-fig-1')).toBeNull()
    const dishesAfter = await repos.dishes.listByRestaurant('r-fig')
    expect(dishesAfter.some((d) => d.visitId === 'v-fig-1')).toBe(false)
    expect(dishesAfter.length).toBeGreaterThan(0) // the other visit's dish survives
    await expect(repos.visits.remove('v-fig-1')).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('DishRepository', () => {
  it('creates, updates and removes dishes', async () => {
    const dish = await repos.dishes.create({
      restaurantId: 'r-noodle',
      name: 'Gyoza',
      verdict: 'skip',
      lensIds: ['vegetarian'],
    })
    expect(await repos.dishes.getById(dish.id)).toEqual(dish)

    const flipped = await repos.dishes.update(dish.id, { verdict: 'order-again' })
    expect(flipped.verdict).toBe('order-again')

    await repos.dishes.remove(dish.id)
    expect(await repos.dishes.getById(dish.id)).toBeNull()
  })

  it('rejects dishes pointing at unknown restaurants, lenses, or another restaurant’s visit', async () => {
    const base = { name: 'Soup', verdict: 'order-again' as const, lensIds: [] as string[] }
    await expect(repos.dishes.create({ ...base, restaurantId: 'ghost' })).rejects.toMatchObject({
      code: 'invalid_reference',
    })
    await expect(
      repos.dishes.create({ ...base, restaurantId: 'r-fig', lensIds: ['keto'] }),
    ).rejects.toMatchObject({ code: 'invalid_reference' })
    await expect(
      repos.dishes.create({ ...base, restaurantId: 'r-noodle', visitId: 'v-fig-1' }),
    ).rejects.toMatchObject({ code: 'invalid_reference' })
  })

  it('lists by restaurant', async () => {
    const dishes = await repos.dishes.listByRestaurant('r-sprout')
    expect(dishes.length).toBeGreaterThanOrEqual(3)
    expect(dishes.every((d) => d.restaurantId === 'r-sprout')).toBe(true)
  })
})

describe('GoBackRepository', () => {
  it('adds and removes a go-back entry', async () => {
    expect(await repos.goBack.getByRestaurantId('r-noodle')).toBeNull()
    const entry = await repos.goBack.create({ restaurantId: 'r-noodle', note: 'Try the gyoza' })
    expect(await repos.goBack.getByRestaurantId('r-noodle')).toEqual(entry)

    await repos.goBack.remove(entry.id)
    expect(await repos.goBack.getByRestaurantId('r-noodle')).toBeNull()
  })

  it('allows only one entry per restaurant', async () => {
    await expect(repos.goBack.create({ restaurantId: 'r-fig' })).rejects.toMatchObject({
      code: 'conflict',
    })
  })

  it('rejects unknown restaurants', async () => {
    await expect(repos.goBack.create({ restaurantId: 'ghost' })).rejects.toMatchObject({
      code: 'invalid_reference',
    })
  })

  it('updates the note and lists newest first', async () => {
    const [entry] = await repos.goBack.list()
    const updated = await repos.goBack.update(entry!.id, { note: 'New plan' })
    expect(updated.note).toBe('New plan')

    const added = (await repos.goBack.list()).map((g) => g.addedAt)
    expect(added).toEqual([...added].sort().reverse())
  })
})

describe('DietLensRepository', () => {
  it('lists lenses in display order, including the core diets', async () => {
    const lenses = await repos.lenses.list()
    const orders = lenses.map((l) => l.sortOrder)
    expect(orders).toEqual([...orders].sort((a, b) => a - b))
    expect(lenses.map((l) => l.id)).toEqual(
      expect.arrayContaining(['vegan', 'vegetarian', 'steak', 'gluten-free']),
    )
  })

  it('getById returns a lens or null', async () => {
    expect((await repos.lenses.getById('vegan'))?.shortLabel).toBe('Vegan')
    expect(await repos.lenses.getById('keto')).toBeNull()
  })
})

describe('UserRepository', () => {
  it('returns the current user', async () => {
    expect(await repos.user.getCurrent()).toMatchObject({
      displayName: 'Summer',
      homeCity: 'Dallas',
    })
  })

  it('updates the profile and persists it', async () => {
    const updated = await repos.user.update({ displayName: 'Sam', defaultLensIds: ['vegetarian'] })
    expect(updated).toMatchObject({
      displayName: 'Sam',
      defaultLensIds: ['vegetarian'],
      homeCity: 'Dallas',
    })
    expect(await repos.user.getCurrent()).toEqual(updated)
  })

  it('rejects a blank name and unknown default lenses', async () => {
    await expect(repos.user.update({ displayName: ' ' })).rejects.toMatchObject({
      code: 'validation',
    })
    await expect(repos.user.update({ defaultLensIds: ['keto'] })).rejects.toMatchObject({
      code: 'invalid_reference',
    })
  })
})
