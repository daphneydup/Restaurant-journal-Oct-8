import type { z } from 'zod'
import { RepositoryError } from '../errors'
import type { MockDb } from './db'

/** Copies data across the "network boundary", so callers can never mutate the store. */
export function clone<T>(value: T): T {
  return structuredClone(value)
}

/** Validates with a Zod schema and throws a RepositoryError('validation') on failure. */
export function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value)
  if (!result.success) {
    const message = result.error.issues
      .map((issue) =>
        issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
      )
      .join('; ')
    throw new RepositoryError('validation', message, { cause: result.error })
  }
  return result.data
}

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
