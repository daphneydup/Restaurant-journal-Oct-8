import { beforeEach, describe, expect, it } from 'vitest'
import { createFakeSupabase, FAKE_USER_ID, type FakeSupabase } from '@/test/fakeSupabase'
import type { Repositories } from '../repositories'

const LENSES = [
  {
    id: 'vegan',
    label: 'Vegan options',
    short_label: 'Vegan',
    icon: 'leaf',
    kind: 'restriction',
    sort_order: 1,
  },
  {
    id: 'steak',
    label: 'Steak / meat',
    short_label: 'Steak',
    icon: 'beef',
    kind: 'preference',
    sort_order: 3,
  },
  {
    id: 'gluten-free',
    label: 'Gluten-free',
    short_label: 'Gluten-free',
    icon: 'wheat-off',
    kind: 'restriction',
    sort_order: 4,
  },
]

const restaurantRow = (over: Record<string, unknown> = {}) => ({
  id: 'r-1',
  name: 'Ember & Orchard',
  neighborhood: 'Uptown',
  city: 'Dallas',
  price_tier: 3,
  cuisine: 'Wood-fired American',
  created_at: '2026-10-01T12:00:00+00:00',
  ...over,
})

const visitRow = (over: Record<string, unknown> = {}) => ({
  id: 'v-1',
  restaurant_id: 'r-1',
  date: '2026-10-05',
  worked_for_everyone: 'yes',
  price_tier: 3,
  worth_it: true,
  note: 'Great',
  companions: ['Maya'],
  photo_urls: [],
  created_at: '2026-10-05T19:00:00+00:00',
  visit_ratings: [
    { lens_id: 'vegan', rating: 5 },
    { lens_id: 'steak', rating: 4 },
  ],
  ...over,
})

let fake: FakeSupabase
let repos: Repositories

beforeEach(() => {
  fake = createFakeSupabase()
  fake.on('GET', /\/rest\/v1\/diet_lenses$/, { body: LENSES })
  repos = fake.repositories()
})

const lastData = () => fake.dataCalls().at(-1)!
const postsTo = (path: RegExp) =>
  fake.dataCalls().filter((c) => c.method === 'POST' && path.test(c.path))

describe('restaurants', () => {
  it('lists restaurants, mapping snake_case rows to the app’s shape, A to Z', async () => {
    fake.on('GET', /\/rest\/v1\/restaurants$/, {
      body: [restaurantRow({ id: 'r-2', name: 'Zed', cuisine: null }), restaurantRow()],
    })
    const list = await repos.restaurants.list()

    expect(list.map((r) => r.name)).toEqual(['Ember & Orchard', 'Zed'])
    expect(list[0]).toEqual({
      id: 'r-1',
      name: 'Ember & Orchard',
      neighborhood: 'Uptown',
      city: 'Dallas',
      priceTier: 3,
      cuisine: 'Wood-fired American',
      createdAt: '2026-10-01T12:00:00+00:00',
    })
    expect('cuisine' in list[1]!).toBe(false) // null in the database means "not set"
  })

  it('getById returns the restaurant, or null when there is no such row', async () => {
    fake.on('GET', /\/rest\/v1\/restaurants$/, (call) =>
      call.search.get('id') === 'eq.r-1' ? { body: [restaurantRow()] } : { body: [] },
    )
    expect((await repos.restaurants.getById('r-1'))?.name).toBe('Ember & Orchard')
    expect(await repos.restaurants.getById('nope')).toBeNull()
  })

  it('create sends snake_case columns and returns the saved row', async () => {
    fake.on('POST', /\/rest\/v1\/restaurants$/, {
      status: 201,
      body: [restaurantRow({ id: 'new-1', cuisine: null })],
    })
    const created = await repos.restaurants.create({
      name: '  Ember & Orchard ',
      neighborhood: 'Uptown',
      city: 'Dallas',
      priceTier: 3,
    })

    expect(created.id).toBe('new-1')
    expect(lastData().body).toEqual({
      name: 'Ember & Orchard', // trimmed by validation before sending
      neighborhood: 'Uptown',
      city: 'Dallas',
      price_tier: 3,
      cuisine: null,
    })
    expect(lastData().headers.get('prefer')).toContain('return=representation')
  })

  it('create validates first, so bad input never reaches the network', async () => {
    await expect(
      repos.restaurants.create({ name: ' ', neighborhood: 'Uptown', city: 'Dallas', priceTier: 3 }),
    ).rejects.toMatchObject({ code: 'validation' })
    expect(fake.dataCalls()).toHaveLength(0)
  })

  it('update merges the patch over the existing row and validates the result', async () => {
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [restaurantRow()] })
    fake.on('PATCH', /\/rest\/v1\/restaurants$/, { body: [restaurantRow({ price_tier: 4 })] })

    const updated = await repos.restaurants.update('r-1', { priceTier: 4 })
    expect(updated.priceTier).toBe(4)
    const patch = fake.dataCalls().find((c) => c.method === 'PATCH')!
    expect(patch.search.get('id')).toBe('eq.r-1')
    expect(patch.body).toMatchObject({ name: 'Ember & Orchard', price_tier: 4 })

    await expect(repos.restaurants.update('r-1', { name: '' })).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('update and remove report not_found for an unknown id', async () => {
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [] })
    fake.on('DELETE', /\/rest\/v1\/restaurants$/, { body: [] })
    await expect(repos.restaurants.update('ghost', { priceTier: 1 })).rejects.toMatchObject({
      code: 'not_found',
    })
    await expect(repos.restaurants.remove('ghost')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('remove deletes by id', async () => {
    fake.on('DELETE', /\/rest\/v1\/restaurants$/, { body: [{ id: 'r-1' }] })
    await expect(repos.restaurants.remove('r-1')).resolves.toBeUndefined()
    expect(lastData().search.get('id')).toBe('eq.r-1')
  })
})

describe('error translation', () => {
  const failWith = (status: number, body: unknown) =>
    fake.on('POST', /\/rest\/v1\/restaurants$/, { status, body })
  const input = { name: 'X', neighborhood: 'Y', city: 'Dallas', priceTier: 2 as const }

  it('a unique violation becomes conflict', async () => {
    failWith(409, { code: '23505', message: 'duplicate key value violates unique constraint' })
    await expect(repos.restaurants.create(input)).rejects.toMatchObject({ code: 'conflict' })
  })

  it('a foreign key violation becomes invalid_reference', async () => {
    failWith(409, { code: '23503', message: 'violates foreign key constraint' })
    await expect(repos.restaurants.create(input)).rejects.toMatchObject({
      code: 'invalid_reference',
    })
  })

  it('a check violation becomes validation', async () => {
    failWith(400, { code: '23514', message: 'violates check constraint' })
    await expect(repos.restaurants.create(input)).rejects.toMatchObject({ code: 'validation' })
  })

  it('a row-level-security refusal or server error becomes unavailable (a retryable state)', async () => {
    failWith(403, { code: '42501', message: 'new row violates row-level security policy' })
    await expect(repos.restaurants.create(input)).rejects.toMatchObject({ code: 'unavailable' })
    failWith(500, { message: 'internal error' })
    await expect(repos.restaurants.create(input)).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('a network failure becomes unavailable', async () => {
    const offline = createFakeSupabase()
    offline.on('GET', /\/rest\/v1\/restaurants$/, () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(offline.repositories().restaurants.list()).rejects.toMatchObject({
      code: 'unavailable',
    })
  })
})

describe('visits', () => {
  it('lists visits with ratings embedded, newest first, ratings in diet order', async () => {
    fake.on('GET', /\/rest\/v1\/visits$/, {
      body: [
        visitRow({
          visit_ratings: [
            { lens_id: 'steak', rating: 4 },
            { lens_id: 'vegan', rating: 5 },
          ],
        }),
      ],
    })
    const [visit] = await repos.visits.list()

    const requested = fake.dataCalls().find((c) => c.path.endsWith('/visits'))!
    expect(requested.search.get('select')).toContain('visit_ratings(lens_id,rating)')
    expect(requested.search.getAll('order')).toEqual(['date.desc,created_at.desc'])
    expect(visit).toMatchObject({
      id: 'v-1',
      restaurantId: 'r-1',
      workedForEveryone: 'yes',
      priceTier: 3,
      worthIt: true,
      note: 'Great',
      companions: ['Maya'],
    })
    expect(visit!.ratings.map((r) => r.lensId)).toEqual(['vegan', 'steak']) // not the order the DB returned
  })

  it('listByRestaurant filters by restaurant', async () => {
    fake.on('GET', /\/rest\/v1\/visits$/, { body: [] })
    await repos.visits.listByRestaurant('r-9')
    const request = fake.dataCalls().find((c) => c.path.endsWith('/visits'))!
    expect(request.search.get('restaurant_id')).toBe('eq.r-9')
  })

  it('omits optional fields that are null in the database', async () => {
    fake.on('GET', /\/rest\/v1\/visits$/, { body: [visitRow({ worth_it: null, note: null })] })
    const [visit] = await repos.visits.list()
    expect('worthIt' in visit!).toBe(false)
    expect('note' in visit!).toBe(false)
  })

  it('create inserts the visit, then its ratings, then reads it back', async () => {
    fake.on('POST', /\/rest\/v1\/visits$/, { status: 201, body: [{ id: 'v-new' }] })
    fake.on('POST', /\/rest\/v1\/visit_ratings$/, { status: 201, body: null })
    fake.on('GET', /\/rest\/v1\/visits$/, { body: [visitRow({ id: 'v-new' })] })

    const visit = await repos.visits.create({
      restaurantId: 'r-1',
      date: '2026-10-05',
      ratings: [{ lensId: 'vegan', rating: 5 }],
      workedForEveryone: 'yes',
      priceTier: 3,
      companions: [],
      photoUrls: [],
    })
    expect(visit.id).toBe('v-new')
    expect(postsTo(/\/visits$/)[0]!.body).toMatchObject({
      restaurant_id: 'r-1',
      worked_for_everyone: 'yes',
      price_tier: 3,
    })
    expect(postsTo(/\/visit_ratings$/)[0]!.body).toEqual([
      { visit_id: 'v-new', lens_id: 'vegan', rating: 5 },
    ])
  })

  it('create removes the visit again if saving its ratings fails', async () => {
    fake.on('POST', /\/rest\/v1\/visits$/, { status: 201, body: [{ id: 'v-new' }] })
    fake.on('POST', /\/rest\/v1\/visit_ratings$/, {
      status: 409,
      body: { code: '23503', message: 'unknown lens' },
    })
    fake.on('DELETE', /\/rest\/v1\/visits$/, { body: [{ id: 'v-new' }] })

    await expect(
      repos.visits.create({
        restaurantId: 'r-1',
        date: '2026-10-05',
        ratings: [{ lensId: 'keto', rating: 5 }],
        workedForEveryone: 'yes',
        priceTier: 3,
        companions: [],
        photoUrls: [],
      }),
    ).rejects.toMatchObject({ code: 'invalid_reference' })
    const cleanup = fake.dataCalls().find((c) => c.method === 'DELETE')!
    expect(cleanup.search.get('id')).toBe('eq.v-new')
  })

  it('remove reports not_found when nothing was deleted', async () => {
    fake.on('DELETE', /\/rest\/v1\/visits$/, { body: [] })
    await expect(repos.visits.remove('ghost')).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('logVisit (one database function = one transaction)', () => {
  const input = {
    restaurant: {
      mode: 'new' as const,
      name: 'Fresh Plate',
      neighborhood: 'Uptown',
      city: 'Dallas',
    },
    visit: {
      date: '2026-10-07',
      ratings: [{ lensId: 'vegan', rating: 5 as const }],
      workedForEveryone: 'yes' as const,
      priceTier: 3 as const,
      companions: [],
      photoUrls: [],
    },
    dishes: [{ name: 'Gyoza', verdict: 'skip' as const, lensIds: ['vegan'] }],
    addToGoBack: true,
  }

  function routeSuccess() {
    fake.on('POST', /\/rest\/v1\/rpc\/log_visit$/, {
      body: { restaurant_id: 'r-new', visit_id: 'v-new', created_restaurant: true },
    })
    fake.on('GET', /\/rest\/v1\/restaurants$/, {
      body: [restaurantRow({ id: 'r-new', name: 'Fresh Plate' })],
    })
    fake.on('GET', /\/rest\/v1\/visits$/, {
      body: [visitRow({ id: 'v-new', restaurant_id: 'r-new' })],
    })
    fake.on('GET', /\/rest\/v1\/dishes$/, {
      body: [
        {
          id: 'd-1',
          restaurant_id: 'r-new',
          visit_id: 'v-new',
          name: 'Gyoza',
          verdict: 'skip',
          lens_ids: ['vegan'],
          photo_url: null,
          created_at: '2026-10-07T19:00:00+00:00',
        },
      ],
    })
  }

  it('sends the whole submission in a single call and assembles the result', async () => {
    routeSuccess()
    const result = await repos.visits.logVisit(input)

    const rpc = fake.dataCalls().filter((c) => c.path.endsWith('/rpc/log_visit'))
    expect(rpc).toHaveLength(1)
    expect(rpc[0]!.body).toEqual({ p: input })
    // Nothing else was written: no separate inserts that could half-succeed.
    expect(fake.dataCalls().filter((c) => c.method === 'POST')).toHaveLength(1)

    expect(result.createdRestaurant).toBe(true)
    expect(result.restaurant).toMatchObject({ id: 'r-new', name: 'Fresh Plate' })
    expect(result.visit.id).toBe('v-new')
    expect(result.dishes).toEqual([
      expect.objectContaining({
        name: 'Gyoza',
        verdict: 'skip',
        visitId: 'v-new',
        lensIds: ['vegan'],
      }),
    ])
  })

  it('validates before sending, so invalid submissions never reach the database', async () => {
    await expect(
      repos.visits.logVisit({ ...input, visit: { ...input.visit, ratings: [] } }),
    ).rejects.toMatchObject({
      code: 'validation',
    })
    expect(fake.dataCalls()).toHaveLength(0)
  })

  it('rejects dishes tagged with an unknown diet without calling the function', async () => {
    await expect(
      repos.visits.logVisit({
        ...input,
        dishes: [{ name: 'X', verdict: 'skip', lensIds: ['keto'] }],
      }),
    ).rejects.toMatchObject({ code: 'invalid_reference' })
    expect(fake.dataCalls().some((c) => c.path.endsWith('/rpc/log_visit'))).toBe(false)
  })

  it('reports a duplicate restaurant as conflict', async () => {
    fake.on('POST', /\/rest\/v1\/rpc\/log_visit$/, {
      status: 409,
      body: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "restaurants_unique_spot"',
      },
    })
    await expect(repos.visits.logVisit(input)).rejects.toMatchObject({ code: 'conflict' })
  })

  it('reports an unknown restaurant as invalid_reference', async () => {
    fake.on('POST', /\/rest\/v1\/rpc\/log_visit$/, {
      status: 409,
      body: { code: '23503', message: 'Restaurant does not exist' },
    })
    await expect(
      repos.visits.logVisit({ ...input, restaurant: { mode: 'existing', restaurantId: 'ghost' } }),
    ).rejects.toMatchObject({ code: 'invalid_reference' })
  })
})

describe('dishes, go-back, lenses and profile', () => {
  it('creates a dish after checking its diets exist', async () => {
    fake.on('POST', /\/rest\/v1\/dishes$/, {
      status: 201,
      body: [
        {
          id: 'd-1',
          restaurant_id: 'r-1',
          visit_id: null,
          name: 'Soup',
          verdict: 'order-again',
          lens_ids: ['vegan'],
          photo_url: null,
          created_at: '2026-10-07T19:00:00+00:00',
        },
      ],
    })
    const dish = await repos.dishes.create({
      restaurantId: 'r-1',
      name: 'Soup',
      verdict: 'order-again',
      lensIds: ['vegan'],
    })
    expect(dish).toMatchObject({ id: 'd-1', name: 'Soup', lensIds: ['vegan'] })
    expect('visitId' in dish).toBe(false)
    expect(postsTo(/\/dishes$/)[0]!.body).toMatchObject({
      restaurant_id: 'r-1',
      visit_id: null,
      lens_ids: ['vegan'],
    })

    await expect(
      repos.dishes.create({
        restaurantId: 'r-1',
        name: 'Soup',
        verdict: 'skip',
        lensIds: ['keto'],
      }),
    ).rejects.toMatchObject({ code: 'invalid_reference' })
  })

  it('a dish pointing at another restaurant’s visit is refused by the database (invalid_reference)', async () => {
    fake.on('POST', /\/rest\/v1\/dishes$/, {
      status: 409,
      body: { code: '23503', message: 'violates foreign key' },
    })
    await expect(
      repos.dishes.create({
        restaurantId: 'r-1',
        visitId: 'v-of-another',
        name: 'Soup',
        verdict: 'skip',
        lensIds: [],
      }),
    ).rejects.toMatchObject({ code: 'invalid_reference' })
  })

  it('go-back: finds an entry by restaurant, and reports a second one as conflict', async () => {
    fake.on('GET', /\/rest\/v1\/go_back_entries$/, (call) =>
      call.search.get('restaurant_id') === 'eq.r-1'
        ? {
            body: [
              {
                id: 'g-1',
                restaurant_id: 'r-1',
                note: null,
                added_at: '2026-10-01T12:00:00+00:00',
              },
            ],
          }
        : { body: [] },
    )
    expect(await repos.goBack.getByRestaurantId('r-1')).toEqual({
      id: 'g-1',
      restaurantId: 'r-1',
      addedAt: '2026-10-01T12:00:00+00:00',
    })
    expect(await repos.goBack.getByRestaurantId('r-2')).toBeNull()

    fake.on('POST', /\/rest\/v1\/go_back_entries$/, {
      status: 409,
      body: { code: '23505', message: 'duplicate' },
    })
    await expect(repos.goBack.create({ restaurantId: 'r-1' })).rejects.toMatchObject({
      code: 'conflict',
    })
  })

  it('lenses: lists in display order and fetches them only once per session', async () => {
    const lenses = await repos.lenses.list()
    await repos.lenses.list()
    await repos.lenses.getById('vegan')
    expect(lenses.map((l) => l.id)).toEqual(['vegan', 'steak', 'gluten-free'])
    expect(lenses[0]).toEqual({
      id: 'vegan',
      label: 'Vegan options',
      shortLabel: 'Vegan',
      icon: 'leaf',
      kind: 'restriction',
      sortOrder: 1,
    })
    expect(fake.dataCalls().filter((c) => c.path.endsWith('/diet_lenses'))).toHaveLength(1)
    expect(await repos.lenses.getById('keto')).toBeNull()
  })

  it('lenses: a failed fetch is not cached', async () => {
    const other = createFakeSupabase()
    let first = true
    other.on('GET', /\/rest\/v1\/diet_lenses$/, () => {
      if (first) {
        first = false
        return { status: 500, body: { message: 'boom' } }
      }
      return { body: LENSES }
    })
    const repo = other.repositories()
    await expect(repo.lenses.list()).rejects.toMatchObject({ code: 'unavailable' })
    expect(await repo.lenses.list()).toHaveLength(3)
  })

  it('profile: creates one with defaults the first time, then updates it', async () => {
    const profile = {
      id: FAKE_USER_ID,
      display_name: 'Friend',
      home_city: 'Dallas',
      default_lens_ids: [],
    }
    fake.on('GET', /\/rest\/v1\/profiles$/, { body: [] })
    fake.on('POST', /\/rest\/v1\/profiles$/, { status: 201, body: [profile] })

    const created = await repos.user.getCurrent()
    expect(created).toEqual({
      id: FAKE_USER_ID,
      displayName: 'Friend',
      homeCity: 'Dallas',
      defaultLensIds: [],
    })
    expect(postsTo(/\/profiles$/)[0]!.body).toEqual({ id: FAKE_USER_ID })

    fake.on('GET', /\/rest\/v1\/profiles$/, { body: [profile] })
    fake.on('PATCH', /\/rest\/v1\/profiles$/, {
      body: [{ ...profile, display_name: 'Summer', default_lens_ids: ['vegan', 'steak'] }],
    })
    const updated = await repos.user.update({
      displayName: 'Summer',
      defaultLensIds: ['vegan', 'steak'],
    })
    expect(updated).toMatchObject({ displayName: 'Summer', defaultLensIds: ['vegan', 'steak'] })
    const patch = fake.dataCalls().find((c) => c.method === 'PATCH')!
    expect(patch.body).toEqual({
      display_name: 'Summer',
      home_city: 'Dallas',
      default_lens_ids: ['vegan', 'steak'],
    })

    await expect(repos.user.update({ defaultLensIds: ['keto'] })).rejects.toMatchObject({
      code: 'invalid_reference',
    })
    await expect(repos.user.update({ displayName: ' ' })).rejects.toMatchObject({
      code: 'validation',
    })
  })
})

describe('malformed data from the server', () => {
  it('fails with a validation error instead of letting bad data into the app', async () => {
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [restaurantRow({ price_tier: 9 })] })
    await expect(repos.restaurants.list()).rejects.toMatchObject({ code: 'validation' })

    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [{ id: 'r-1' }] })
    await expect(repos.restaurants.list()).rejects.toMatchObject({ code: 'validation' })
  })
})
