/**
 * THE single dependency-injection point for the data layer.
 *
 * This is the only app file allowed to import a concrete repository implementation
 * (ESLint enforces it). Everything else reaches data through the query hooks, which read
 * the repositories from React context.
 *
 * To move to Supabase: implement `Repositories` in `src/data/supabase/` and change
 * `createRepositories` below. Nothing else in the app changes.
 */
import { createMockRepositories } from './mock'
import type { Repositories } from './repositories'

export type { Repositories } from './repositories'
export type { DevControls } from './repositories'
export { RepositoryError, isRepositoryError, type RepositoryErrorCode } from './errors'

export function createRepositories(): Repositories {
  return createMockRepositories({ latencyMs: 300 })
}
