import { RepositoryError } from '../errors'
import type { GoBackRepository } from '../repositories'
import { parseOrThrow } from '../validation'
import { goBackEntryInputSchema, goBackEntrySchema, type GoBackEntry } from '@/types'
import { unwrap, type SupabaseContext } from './context'
import { goBackColumns, toGoBackEntry, toList } from './rows'

export function createSupabaseGoBackRepository(ctx: SupabaseContext): GoBackRepository {
  const table = () => ctx.client.from('go_back_entries')

  async function findWhere(
    column: 'id' | 'restaurant_id',
    value: string,
  ): Promise<GoBackEntry | null> {
    const row = await unwrap(ctx, () => table().select('*').eq(column, value).maybeSingle())
    return row ? toGoBackEntry(row) : null
  }

  return {
    async list() {
      const rows = await unwrap(ctx, () =>
        table().select('*').order('added_at', { ascending: false }),
      )
      return toList(rows, toGoBackEntry)
    },

    getById: (id) => findWhere('id', id),
    getByRestaurantId: (restaurantId) => findWhere('restaurant_id', restaurantId),

    async create(input) {
      const data = parseOrThrow(goBackEntryInputSchema, input)
      // One entry per restaurant is enforced by a unique constraint (reported as `conflict`).
      const row = await unwrap(ctx, () => table().insert(goBackColumns(data)).select().single())
      return toGoBackEntry(row)
    },

    async update(id, patch) {
      const existing = await findWhere('id', id)
      if (!existing) throw new RepositoryError('not_found', `Go-back entry "${id}" was not found.`)
      const next = parseOrThrow(goBackEntrySchema, {
        ...existing,
        ...patch,
        id,
        addedAt: existing.addedAt,
      })
      const row = await unwrap(ctx, () =>
        table().update(goBackColumns(next)).eq('id', id).select().single(),
      )
      return toGoBackEntry(row)
    },

    async remove(id) {
      const rows = await unwrap(ctx, () => table().delete().eq('id', id).select('id'))
      if (!rows || rows.length === 0)
        throw new RepositoryError('not_found', `Go-back entry "${id}" was not found.`)
    },
  }
}
