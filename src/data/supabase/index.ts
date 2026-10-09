import type { Repositories } from '../repositories'
import { createSupabaseAuthRepository } from './authRepository'
import { createSupabaseClient, type SupabaseConfig } from './client'
import { createSessionProvider, type SupabaseContext } from './context'
import { createSupabaseDishRepository } from './dishRepository'
import { createSupabaseGoBackRepository } from './goBackRepository'
import { createLensCache } from './lensRepository'
import { createSupabaseRestaurantRepository } from './restaurantRepository'
import { createSupabaseUserRepository } from './userRepository'
import { createSupabaseVisitRepository } from './visitRepository'

export type { SupabaseConfig } from './client'

/**
 * Every repository, backed by one Supabase project. Only `src/data/index.ts` (and tests) may
 * import this module. There are no `dev` controls: the data is real.
 */
export function createSupabaseRepositories(config: SupabaseConfig): Repositories {
  const client = createSupabaseClient(config)
  const ctx: SupabaseContext = { client, userId: createSessionProvider(client) }
  const lenses = createLensCache(ctx)

  return {
    kind: 'supabase',
    restaurants: createSupabaseRestaurantRepository(ctx),
    visits: createSupabaseVisitRepository(ctx, lenses),
    dishes: createSupabaseDishRepository(ctx, lenses),
    goBack: createSupabaseGoBackRepository(ctx),
    lenses,
    user: createSupabaseUserRepository(ctx, lenses),
    auth: createSupabaseAuthRepository(ctx),
  }
}
