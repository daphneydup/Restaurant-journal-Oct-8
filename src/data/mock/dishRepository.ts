import { RepositoryError } from '../errors'
import type { DishRepository } from '../repositories'
import { dishInputSchema, dishSchema, type Dish } from '@/types'
import {
  assertLensesExist,
  assertRestaurantExists,
  clone,
  newestFirst,
  notFound,
  parseOrThrow,
} from './helpers'
import type { MockStore } from './store'

const newest = newestFirst<Dish>((d) => d.createdAt)

export function createMockDishRepository(store: MockStore): DishRepository {
  const assertReferences = (dish: Pick<Dish, 'restaurantId' | 'visitId' | 'lensIds'>) => {
    const db = store.read()
    assertRestaurantExists(db, dish.restaurantId)
    assertLensesExist(db, dish.lensIds)
    if (dish.visitId !== undefined) {
      const visit = db.visits.find((v) => v.id === dish.visitId)
      if (!visit || visit.restaurantId !== dish.restaurantId) {
        throw new RepositoryError(
          'invalid_reference',
          `Visit "${dish.visitId}" does not belong to this restaurant.`,
        )
      }
    }
  }

  return {
    list: () => store.run(() => clone([...store.read().dishes].sort(newest))),

    listByRestaurant: (restaurantId) =>
      store.run(() =>
        clone(
          store
            .read()
            .dishes.filter((d) => d.restaurantId === restaurantId)
            .sort(newest),
        ),
      ),

    getById: (id) => store.run(() => clone(store.read().dishes.find((d) => d.id === id) ?? null)),

    create: (input) =>
      store.run(() => {
        const data = parseOrThrow(dishInputSchema, input)
        assertReferences(data)
        const dish: Dish = { id: store.newId(), ...data, createdAt: store.now().toISOString() }
        store.commit((db) => ({ ...db, dishes: [...db.dishes, dish] }))
        return clone(dish)
      }),

    update: (id, patch) =>
      store.run(() => {
        const existing = store.read().dishes.find((d) => d.id === id) ?? notFound('Dish', id)
        const next = parseOrThrow(dishSchema, {
          ...existing,
          ...patch,
          id,
          createdAt: existing.createdAt,
        })
        assertReferences(next)
        store.commit((db) => ({ ...db, dishes: db.dishes.map((d) => (d.id === id ? next : d)) }))
        return clone(next)
      }),

    remove: (id) =>
      store.run(() => {
        if (!store.read().dishes.some((d) => d.id === id)) notFound('Dish', id)
        store.commit((db) => ({ ...db, dishes: db.dishes.filter((d) => d.id !== id) }))
      }),
  }
}
