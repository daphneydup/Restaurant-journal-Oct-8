import { z } from 'zod'
import { RepositoryError } from '../errors'
import type { VisitRepository } from '../repositories'
import { parseOrThrow } from '../validation'
import { logVisitInputSchema, visitInputSchema, visitSchema, type Visit } from '@/types'
import { unwrap, type SupabaseContext } from './context'
import type { LensCache } from './lensRepository'
import {
  ratingRows,
  toDish,
  toList,
  toRestaurant,
  toVisit,
  visitColumns,
  VISIT_SELECT,
} from './rows'

const logVisitResult = z.object({
  restaurant_id: z.string(),
  visit_id: z.string(),
  created_restaurant: z.boolean(),
  // Absent from databases that haven't run the rewards migration yet.
  points_earned: z.number().int().default(0),
})

export function createSupabaseVisitRepository(
  ctx: SupabaseContext,
  lenses: LensCache,
): VisitRepository {
  const table = () => ctx.client.from('visits')

  /** Ratings come back in primary-key order; show them in the diets' display order instead. */
  async function ordered(visits: Visit[]): Promise<Visit[]> {
    const order = new Map((await lenses.list()).map((lens, index) => [lens.id, index]))
    return visits.map((visit) => ({
      ...visit,
      ratings: [...visit.ratings].sort(
        (a, b) => (order.get(a.lensId) ?? 0) - (order.get(b.lensId) ?? 0),
      ),
    }))
  }

  async function find(id: string): Promise<Visit | null> {
    const row = await unwrap(ctx, () => table().select(VISIT_SELECT).eq('id', id).maybeSingle())
    return row ? ((await ordered([toVisit(row)]))[0] ?? null) : null
  }

  async function listWhere(restaurantId?: string): Promise<Visit[]> {
    const rows = await unwrap(ctx, () => {
      const query = table().select(VISIT_SELECT)
      return (restaurantId ? query.eq('restaurant_id', restaurantId) : query)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
    })
    return ordered(toList(rows, toVisit))
  }

  async function replaceRatings(visitId: string, ratings: Visit['ratings']) {
    await unwrap(ctx, () => ctx.client.from('visit_ratings').delete().eq('visit_id', visitId))
    await unwrap(ctx, () => ctx.client.from('visit_ratings').insert(ratingRows(visitId, ratings)))
  }

  return {
    list: () => listWhere(),
    listByRestaurant: (restaurantId) => listWhere(restaurantId),
    getById: (id) => find(id),

    async create(input) {
      const data = parseOrThrow(visitInputSchema, input)
      const { ratings, ...rest } = data
      const created = await unwrap(ctx, () =>
        table().insert(visitColumns(rest)).select('id').single(),
      )
      const id = parseOrThrow(z.object({ id: z.string() }), created).id
      try {
        await unwrap(ctx, () => ctx.client.from('visit_ratings').insert(ratingRows(id, ratings)))
      } catch (error) {
        // The visit is useless without its ratings: remove it rather than leave a half-saved row.
        await unwrap(ctx, () => table().delete().eq('id', id)).catch(() => undefined)
        throw error
      }
      const saved = await find(id)
      if (!saved)
        throw new RepositoryError('unavailable', 'The visit was saved but could not be read back.')
      return saved
    },

    async update(id, patch) {
      const existing = await find(id)
      if (!existing) throw new RepositoryError('not_found', `Visit "${id}" was not found.`)
      const next = parseOrThrow(visitSchema, {
        ...existing,
        ...patch,
        id,
        createdAt: existing.createdAt,
      })
      const { ratings, ...rest } = next
      await unwrap(ctx, () => table().update(visitColumns(rest)).eq('id', id).select('id').single())
      // Not atomic with the row update above; the app has no visit-editing screen yet.
      if (patch.ratings) await replaceRatings(id, ratings)
      const saved = await find(id)
      if (!saved) throw new RepositoryError('not_found', `Visit "${id}" was not found.`)
      return saved
    },

    async remove(id) {
      // Ratings and the dishes logged on this visit go with it (ON DELETE CASCADE).
      const rows = await unwrap(ctx, () => table().delete().eq('id', id).select('id'))
      if (!rows || rows.length === 0)
        throw new RepositoryError('not_found', `Visit "${id}" was not found.`)
    },

    async logVisit(input) {
      const data = parseOrThrow(logVisitInputSchema, input)
      await lenses.assertExist(data.dishes.flatMap((dish) => dish.lensIds))

      // One database function = one transaction: restaurant, visit, ratings, dishes, go-back.
      const raw = await unwrap(ctx, () => ctx.client.rpc('log_visit', { p: data }))
      const result = parseOrThrow(logVisitResult, raw)

      const [restaurantRow, visit, dishRows] = await Promise.all([
        unwrap(ctx, () =>
          ctx.client.from('restaurants').select('*').eq('id', result.restaurant_id).single(),
        ),
        find(result.visit_id),
        unwrap(ctx, () =>
          ctx.client.from('dishes').select('*').eq('visit_id', result.visit_id).order('created_at'),
        ),
      ])
      if (!visit)
        throw new RepositoryError('unavailable', 'The visit was saved but could not be read back.')
      return {
        restaurant: toRestaurant(restaurantRow),
        visit,
        dishes: toList(dishRows, toDish),
        createdRestaurant: result.created_restaurant,
        pointsEarned: result.points_earned,
      }
    },
  }
}
