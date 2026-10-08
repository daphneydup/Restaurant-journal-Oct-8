import { RepositoryError } from '../errors'
import type { GoBackRepository } from '../repositories'
import { goBackEntryInputSchema, goBackEntrySchema, type GoBackEntry } from '@/types'
import { assertRestaurantExists, clone, newestFirst, notFound, parseOrThrow } from './helpers'
import type { MockStore } from './store'

const newest = newestFirst<GoBackEntry>((g) => g.addedAt)

export function createMockGoBackRepository(store: MockStore): GoBackRepository {
  const assertValid = (entry: Pick<GoBackEntry, 'restaurantId'>, ignoreId?: string) => {
    const db = store.read()
    assertRestaurantExists(db, entry.restaurantId)
    if (db.goBackEntries.some((g) => g.id !== ignoreId && g.restaurantId === entry.restaurantId)) {
      throw new RepositoryError('conflict', 'This restaurant is already on your go-back list.')
    }
  }

  return {
    list: () => store.run(() => clone([...store.read().goBackEntries].sort(newest))),

    getById: (id) =>
      store.run(() => clone(store.read().goBackEntries.find((g) => g.id === id) ?? null)),

    getByRestaurantId: (restaurantId) =>
      store.run(() =>
        clone(store.read().goBackEntries.find((g) => g.restaurantId === restaurantId) ?? null),
      ),

    create: (input) =>
      store.run(() => {
        const data = parseOrThrow(goBackEntryInputSchema, input)
        assertValid(data)
        const entry: GoBackEntry = {
          id: store.newId(),
          ...data,
          addedAt: store.now().toISOString(),
        }
        store.commit((db) => ({ ...db, goBackEntries: [...db.goBackEntries, entry] }))
        return clone(entry)
      }),

    update: (id, patch) =>
      store.run(() => {
        const existing =
          store.read().goBackEntries.find((g) => g.id === id) ?? notFound('Go-back entry', id)
        const next = parseOrThrow(goBackEntrySchema, {
          ...existing,
          ...patch,
          id,
          addedAt: existing.addedAt,
        })
        assertValid(next, id)
        store.commit((db) => ({
          ...db,
          goBackEntries: db.goBackEntries.map((g) => (g.id === id ? next : g)),
        }))
        return clone(next)
      }),

    remove: (id) =>
      store.run(() => {
        if (!store.read().goBackEntries.some((g) => g.id === id)) notFound('Go-back entry', id)
        store.commit((db) => ({
          ...db,
          goBackEntries: db.goBackEntries.filter((g) => g.id !== id),
        }))
      }),
  }
}
