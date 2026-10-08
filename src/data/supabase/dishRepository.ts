import { RepositoryError } from '../errors'
import type { DishRepository } from '../repositories'
import { parseOrThrow } from '../validation'
import { dishInputSchema, dishSchema, type Dish } from '@/types'
import { unwrap, type SupabaseContext } from './context'
import type { LensCache } from './lensRepository'
import { dishColumns, toDish, toList } from './rows'

export function createSupabaseDishRepository(
  ctx: SupabaseContext,
  lenses: LensCache,
): DishRepository {
  const table = () => ctx.client.from('dishes')

  async function find(id: string): Promise<Dish | null> {
    const row = await unwrap(ctx, () => table().select('*').eq('id', id).maybeSingle())
    return row ? toDish(row) : null
  }

  async function listWhere(restaurantId?: string): Promise<Dish[]> {
    const rows = await unwrap(ctx, () => {
      const query = table().select('*')
      return (restaurantId ? query.eq('restaurant_id', restaurantId) : query).order('created_at', {
        ascending: false,
      })
    })
    return toList(rows, toDish)
  }

  return {
    list: () => listWhere(),
    listByRestaurant: (restaurantId) => listWhere(restaurantId),
    getById: (id) => find(id),

    async create(input) {
      const data = parseOrThrow(dishInputSchema, input)
      await lenses.assertExist(data.lensIds)
      // A visit that belongs to another restaurant is rejected by the composite foreign key.
      const row = await unwrap(ctx, () => table().insert(dishColumns(data)).select().single())
      return toDish(row)
    },

    async update(id, patch) {
      const existing = await find(id)
      if (!existing) throw new RepositoryError('not_found', `Dish "${id}" was not found.`)
      const next = parseOrThrow(dishSchema, {
        ...existing,
        ...patch,
        id,
        createdAt: existing.createdAt,
      })
      await lenses.assertExist(next.lensIds)
      const row = await unwrap(ctx, () =>
        table().update(dishColumns(next)).eq('id', id).select().single(),
      )
      return toDish(row)
    },

    async remove(id) {
      const rows = await unwrap(ctx, () => table().delete().eq('id', id).select('id'))
      if (!rows || rows.length === 0)
        throw new RepositoryError('not_found', `Dish "${id}" was not found.`)
    },
  }
}
