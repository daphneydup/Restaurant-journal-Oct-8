/**
 * THE single dependency-injection point for the data layer.
 *
 * This is the only app file allowed to import a concrete repository implementation
 * (ESLint enforces it). Everything else reaches data through the query hooks, which read
 * the repositories from React context.
 *
 * Which implementation runs is decided by the environment:
 *   - VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY both set -> your Supabase project
 *   - otherwise                                             -> demo data kept in localStorage
 */
import { createMockRepositories } from './mock'
import type { Repositories } from './repositories'

export type { Repositories } from './repositories'
export type { DevControls } from './repositories'
export { RepositoryError, isRepositoryError, type RepositoryErrorCode } from './errors'

export interface DataEnv {
  VITE_SUPABASE_URL?: string | undefined
  VITE_SUPABASE_ANON_KEY?: string | undefined
}

export async function createRepositories(env: DataEnv = import.meta.env): Promise<Repositories> {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (url && anonKey) {
    // Loaded on demand, so the Supabase client isn't downloaded when running on demo data.
    const { createSupabaseRepositories } = await import('./supabase')
    return createSupabaseRepositories({ url, anonKey })
  }
  return createMockRepositories({ latencyMs: 300 })
}
