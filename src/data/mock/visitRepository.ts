import { visitInputSchema, visitSchema, type Visit } from '@/types'
import type { VisitRepository } from '../repositories'
import {
  assertLensesExist,
  assertRestaurantExists,
  clone,
  newestFirst,
  notFound,
  parseOrThrow,
} from './helpers'
import type { MockStore } from './store'

const newest = (a: Visit, b: Visit) =>
  newestFirst<Visit>((v) => v.date)(a, b) || newestFirst<Visit>((v) => v.createdAt)(a, b)

export function createMockVisitRepository(store: MockStore): VisitRepository {
  const assertReferences = (visit: Pick<Visit, 'restaurantId' | 'ratings'>) => {
    const db = store.read()
    assertRestaurantExists(db, visit.restaurantId)
    assertLensesExist(
      db,
      visit.ratings.map((r) => r.lensId),
    )
  }

  return {
    list: () => store.run(() => clone([...store.read().visits].sort(newest))),

    listByRestaurant: (restaurantId) =>
      store.run(() =>
        clone(
          store
            .read()
            .visits.filter((v) => v.restaurantId === restaurantId)
            .sort(newest),
        ),
      ),

    getById: (id) => store.run(() => clone(store.read().visits.find((v) => v.id === id) ?? null)),

    create: (input) =>
      store.run(() => {
        const data = parseOrThrow(visitInputSchema, input)
        assertReferences(data)
        const visit: Visit = { id: store.newId(), ...data, createdAt: store.now().toISOString() }
        store.commit((db) => ({ ...db, visits: [...db.visits, visit] }))
        return clone(visit)
      }),

    update: (id, patch) =>
      store.run(() => {
        const existing = store.read().visits.find((v) => v.id === id) ?? notFound('Visit', id)
        const next = parseOrThrow(visitSchema, {
          ...existing,
          ...patch,
          id,
          createdAt: existing.createdAt,
        })
        assertReferences(next)
        store.commit((db) => ({ ...db, visits: db.visits.map((v) => (v.id === id ? next : v)) }))
        return clone(next)
      }),

    remove: (id) =>
      store.run(() => {
        if (!store.read().visits.some((v) => v.id === id)) notFound('Visit', id)
        // Mirrors ON DELETE CASCADE for dishes logged on this visit.
        store.commit((db) => ({
          ...db,
          visits: db.visits.filter((v) => v.id !== id),
          dishes: db.dishes.filter((d) => d.visitId !== id),
        }))
      }),
  }
}
