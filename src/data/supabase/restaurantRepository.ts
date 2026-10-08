import { RepositoryError } from '../errors'
import type { RestaurantRepository } from '../repositories'
import { parseOrThrow } from '../validation'
import { restaurantInputSchema, restaurantSchema, type Restaurant } from '@/types'
import { unwrap, type SupabaseContext } from './context'
import { restaurantColumns, toList, toRestaurant } from './rows'

export function createSupabaseRestaurantRepository(ctx: SupabaseContext): RestaurantRepository {
  const table = () => ctx.client.from('restaurants')

  async function find(id: string): Promise<Restaurant | null> {
    const row = await unwrap(ctx, () => table().select('*').eq('id', id).maybeSingle())
    return row ? toRestaurant(row) : null
  }

  return {
    async list() {
      const rows = await unwrap(ctx, () => table().select('*'))
      return toList(rows, toRestaurant).sort((a, b) => a.name.localeCompare(b.name))
    },

    getById: (id) => find(id),

    async create(input) {
      const data = parseOrThrow(restaurantInputSchema, input)
      const row = await unwrap(ctx, () => table().insert(restaurantColumns(data)).select().single())
      return toRestaurant(row)
    },

    async update(id, patch) {
      const existing = await find(id)
      if (!existing) throw new RepositoryError('not_found', `Restaurant "${id}" was not found.`)
      const next = parseOrThrow(restaurantSchema, {
        ...existing,
        ...patch,
        id,
        createdAt: existing.createdAt,
      })
      const row = await unwrap(ctx, () =>
        table().update(restaurantColumns(next)).eq('id', id).select().single(),
      )
      return toRestaurant(row)
    },

    async remove(id) {
      // Visits, dishes and the go-back entry go with it (ON DELETE CASCADE).
      const rows = await unwrap(ctx, () => table().delete().eq('id', id).select('id'))
      if (!rows || rows.length === 0)
        throw new RepositoryError('not_found', `Restaurant "${id}" was not found.`)
    },
  }
}
