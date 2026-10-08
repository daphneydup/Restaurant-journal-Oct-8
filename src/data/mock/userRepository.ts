import { userSchema } from '@/types'
import type { UserRepository } from '../repositories'
import { assertLensesExist, clone, parseOrThrow } from './helpers'
import type { MockStore } from './store'

export function createMockUserRepository(store: MockStore): UserRepository {
  return {
    getCurrent: () => store.run(() => clone(store.read().user)),

    update: (patch) =>
      store.run(() => {
        const existing = store.read().user
        const next = parseOrThrow(userSchema, { ...existing, ...patch, id: existing.id })
        assertLensesExist(store.read(), next.defaultLensIds)
        store.commit((db) => ({ ...db, user: next }))
        return clone(next)
      }),
  }
}
