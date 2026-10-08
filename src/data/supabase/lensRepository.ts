import { RepositoryError } from '../errors'
import type { DietLensRepository } from '../repositories'
import { unwrap, type SupabaseContext } from './context'
import { toLens, toList } from './rows'
import type { DietLens } from '@/types'

export interface LensCache extends DietLensRepository {
  /** Throws `invalid_reference` if any id is not a known lens. Used where the database can't. */
  assertExist(lensIds: readonly string[]): Promise<void>
}

/**
 * Lenses are reference data that rarely change, so they are fetched once per session and shared
 * by the repositories that need to validate lens ids stored in arrays (which have no foreign key).
 */
export function createLensCache(ctx: SupabaseContext): LensCache {
  let cached: Promise<DietLens[]> | null = null

  function load(): Promise<DietLens[]> {
    cached ??= unwrap(ctx, () => ctx.client.from('diet_lenses').select('*').order('sort_order'))
      .then((rows) => toList(rows, toLens).sort((a, b) => a.sortOrder - b.sortOrder))
      .catch((error: unknown) => {
        cached = null // don't cache a failure
        throw error
      })
    return cached
  }

  return {
    list: async () => structuredClone(await load()),
    getById: async (id) => structuredClone((await load()).find((l) => l.id === id) ?? null),
    async assertExist(lensIds) {
      const known = new Set((await load()).map((l) => l.id))
      const unknown = lensIds.filter((id) => !known.has(id))
      if (unknown.length > 0) {
        throw new RepositoryError('invalid_reference', `Unknown diet lens: ${unknown.join(', ')}.`)
      }
    },
  }
}
