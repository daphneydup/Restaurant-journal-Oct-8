import type { User, UserPatch } from '@/types'

/**
 * There is no auth yet, so there is exactly one user: "the current user". With Supabase this
 * becomes the signed-in user's profile row. `update` rejects with `invalid_reference` if a
 * default lens is unknown.
 */
export interface UserRepository {
  getCurrent(): Promise<User>
  update(patch: UserPatch): Promise<User>
}
