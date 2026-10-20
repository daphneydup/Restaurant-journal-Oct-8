import {
  logVisitInputSchema,
  visitInputSchema,
  visitSchema,
  type Dish,
  type PointsEntry,
  type GoBackEntry,
  type Restaurant,
  type Visit,
} from '@/types'
import { awardForVisit } from '@/lib/rewardRules'
import { RepositoryError } from '../errors'
import type { VisitRepository } from '../repositories'
import {
  assertLensesExist,
  assertNoDuplicateRestaurant,
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

  /** The ledger line a new visit earns, or none when a daily limit was reached (see rewardRules). */
  const awardFor = (visit: Visit, restaurant: Restaurant, now: Date): PointsEntry | null => {
    const award = awardForVisit({
      visit,
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      ledger: store.read().rewards.ledger,
      now,
    })
    return award
      ? {
          id: store.newId(),
          kind: 'visit',
          points: award.points,
          label: award.label,
          restaurantId: restaurant.id,
          createdAt: now.toISOString(),
        }
      : null
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

    logVisit: (input) =>
      store.run(() => {
        const data = parseOrThrow(logVisitInputSchema, input)
        const db = store.read()
        const now = store.now().toISOString()

        // Resolve (or build) the restaurant first; nothing is written until everything checks out.
        let restaurant: Restaurant
        let createdRestaurant = false
        if (data.restaurant.mode === 'existing') {
          const { restaurantId } = data.restaurant
          const existing = db.restaurants.find((r) => r.id === restaurantId)
          if (!existing) {
            throw new RepositoryError(
              'invalid_reference',
              `Restaurant "${restaurantId}" does not exist.`,
            )
          }
          restaurant = existing
        } else {
          const { name, neighborhood, city, cuisine } = data.restaurant
          assertNoDuplicateRestaurant(db, { name, neighborhood })
          restaurant = {
            id: store.newId(),
            name,
            neighborhood,
            city,
            priceTier: data.visit.priceTier,
            createdAt: now,
            ...(cuisine !== undefined && { cuisine }),
          }
          createdRestaurant = true
        }

        assertLensesExist(
          db,
          data.visit.ratings.map((r) => r.lensId),
        )
        for (const dish of data.dishes) assertLensesExist(db, dish.lensIds)

        const visit: Visit = {
          id: store.newId(),
          restaurantId: restaurant.id,
          ...data.visit,
          createdAt: now,
        }
        const dishes: Dish[] = data.dishes.map((dish) => ({
          id: store.newId(),
          restaurantId: restaurant.id,
          visitId: visit.id,
          ...dish,
          createdAt: now,
        }))
        const alreadyFlagged = db.goBackEntries.some((g) => g.restaurantId === restaurant.id)
        const goBackEntry: GoBackEntry | null =
          data.addToGoBack && !alreadyFlagged
            ? { id: store.newId(), restaurantId: restaurant.id, addedAt: now }
            : null

        const earned = awardFor(visit, restaurant, store.now())

        // One commit = all or nothing.
        store.commit((current) => ({
          ...current,
          rewards: earned
            ? { ...current.rewards, ledger: [...current.rewards.ledger, earned] }
            : current.rewards,
          restaurants: createdRestaurant
            ? [...current.restaurants, restaurant]
            : current.restaurants,
          visits: [...current.visits, visit],
          dishes: [...current.dishes, ...dishes],
          goBackEntries: goBackEntry
            ? [...current.goBackEntries, goBackEntry]
            : current.goBackEntries,
        }))

        return clone({
          restaurant,
          visit,
          dishes,
          createdRestaurant,
          pointsEarned: earned?.points ?? 0,
        })
      }),

    getById: (id) => store.run(() => clone(store.read().visits.find((v) => v.id === id) ?? null)),

    create: (input) =>
      store.run(() => {
        const data = parseOrThrow(visitInputSchema, input)
        assertReferences(data)
        const visit: Visit = { id: store.newId(), ...data, createdAt: store.now().toISOString() }
        const restaurant = store.read().restaurants.find((r) => r.id === data.restaurantId)
        const earned = restaurant ? awardFor(visit, restaurant, store.now()) : null
        store.commit((db) => ({
          ...db,
          visits: [...db.visits, visit],
          rewards: earned ? { ...db.rewards, ledger: [...db.rewards.ledger, earned] } : db.rewards,
        }))
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
