import { RepositoryError } from '../errors'
import type { MockDb } from './db'

/** Copies data across the "network boundary", so callers can never mutate the store. */
export function clone<T>(value: T): T {
  return structuredClone(value)
}

export { parseOrThrow } from '../validation'

export function assertRestaurantExists(db: MockDb, restaurantId: string) {
  if (!db.restaurants.some((r) => r.id === restaurantId)) {
    throw new RepositoryError('invalid_reference', `Restaurant "${restaurantId}" does not exist.`)
  }
}

export function assertLensesExist(db: MockDb, lensIds: readonly string[]) {
  const known = new Set(db.lenses.map((l) => l.id))
  const unknown = lensIds.filter((id) => !known.has(id))
  if (unknown.length > 0) {
    throw new RepositoryError('invalid_reference', `Unknown diet lens: ${unknown.join(', ')}.`)
  }
}

export function notFound(entity: string, id: string): never {
  throw new RepositoryError('not_found', `${entity} "${id}" was not found.`)
}

/** Sort comparator: newest first by an ISO string field. */
export function newestFirst<T>(pick: (item: T) => string) {
  return (a: T, b: T) => pick(b).localeCompare(pick(a))
}

/** Throws `conflict` if another restaurant has the same name and neighborhood (case-insensitive). */
export function assertNoDuplicateRestaurant(
  db: MockDb,
  candidate: { name: string; neighborhood: string },
  ignoreId?: string,
) {
  const clash = db.restaurants.find(
    (r) =>
      r.id !== ignoreId &&
      r.name.toLowerCase() === candidate.name.toLowerCase() &&
      r.neighborhood.toLowerCase() === candidate.neighborhood.toLowerCase(),
  )
  if (clash) {
    throw new RepositoryError(
      'conflict',
      `"${clash.name}" in ${clash.neighborhood} is already saved.`,
    )
  }
}
