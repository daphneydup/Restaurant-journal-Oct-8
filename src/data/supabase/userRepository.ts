import type { UserRepository } from '../repositories'
import { parseOrThrow } from '../validation'
import { userSchema, type User } from '@/types'
import { unwrap, type SupabaseContext } from './context'
import type { LensCache } from './lensRepository'
import { profileColumns, toUser } from './rows'

export function createSupabaseUserRepository(
  ctx: SupabaseContext,
  lenses: LensCache,
): UserRepository {
  const table = () => ctx.client.from('profiles')

  /** The signed-in user's profile, created with defaults the first time it is needed. */
  async function current(): Promise<User> {
    const id = await ctx.userId()
    const existing = await unwrap(ctx, () => table().select('*').eq('id', id).maybeSingle())
    if (existing) return toUser(existing)
    const created = await unwrap(ctx, () => table().insert({ id }).select().single())
    return toUser(created)
  }

  return {
    getCurrent: current,

    async update(patch) {
      const existing = await current()
      const next = parseOrThrow(userSchema, { ...existing, ...patch, id: existing.id })
      await lenses.assertExist(next.defaultLensIds)
      const { id, ...columns } = next
      const row = await unwrap(ctx, () =>
        table().update(profileColumns(columns)).eq('id', id).select().single(),
      )
      return toUser(row)
    },
  }
}
