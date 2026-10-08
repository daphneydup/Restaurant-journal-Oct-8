import type { RestaurantRepository } from '../repositories'
import { restaurantInputSchema, restaurantSchema, type Restaurant } from '@/types'
import { assertNoDuplicateRestaurant, clone, notFound, parseOrThrow } from './helpers'
import type { MockStore } from './store'

export function createMockRestaurantRepository(store: MockStore): RestaurantRepository {
  const assertUnique = (candidate: { name: string; neighborhood: string }, ignoreId?: string) =>
    assertNoDuplicateRestaurant(store.read(), candidate, ignoreId)

  return {
    list: () =>
      store.run(() =>
        clone([...store.read().restaurants].sort((a, b) => a.name.localeCompare(b.name))),
      ),

    getById: (id) =>
      store.run(() => clone(store.read().restaurants.find((r) => r.id === id) ?? null)),

    create: (input) =>
      store.run(() => {
        const data = parseOrThrow(restaurantInputSchema, input)
        assertUnique(data)
        const restaurant: Restaurant = {
          id: store.newId(),
          ...data,
          createdAt: store.now().toISOString(),
        }
        store.commit((db) => ({ ...db, restaurants: [...db.restaurants, restaurant] }))
        return clone(restaurant)
      }),

    update: (id, patch) =>
      store.run(() => {
        const existing =
          store.read().restaurants.find((r) => r.id === id) ?? notFound('Restaurant', id)
        const next = parseOrThrow(restaurantSchema, {
          ...existing,
          ...patch,
          id,
          createdAt: existing.createdAt,
        })
        assertUnique(next, id)
        store.commit((db) => ({
          ...db,
          restaurants: db.restaurants.map((r) => (r.id === id ? next : r)),
        }))
        return clone(next)
      }),

    remove: (id) =>
      store.run(() => {
        if (!store.read().restaurants.some((r) => r.id === id)) notFound('Restaurant', id)
        // Mirrors ON DELETE CASCADE.
        store.commit((db) => ({
          ...db,
          restaurants: db.restaurants.filter((r) => r.id !== id),
          visits: db.visits.filter((v) => v.restaurantId !== id),
          dishes: db.dishes.filter((d) => d.restaurantId !== id),
          goBackEntries: db.goBackEntries.filter((g) => g.restaurantId !== id),
        }))
      }),
  }
}
