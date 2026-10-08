import type { SupabaseClient } from '@supabase/supabase-js'
import { RepositoryError } from '../errors'
import { mapError, type ErrorLike } from './errors'

/** What every Supabase repository needs: the client, and a guarantee someone is signed in. */
export interface SupabaseContext {
  client: SupabaseClient
  /** Resolves with the signed-in user's id, signing in anonymously first if there is no session. */
  userId(): Promise<string>
}

/**
 * Row-level security needs an identity, but this phase has no login screen. So the first call
 * signs in anonymously (Supabase keeps that session in the browser). The same person returns to
 * the same data until they clear site data; real accounts can replace this later.
 */
export function createSessionProvider(client: SupabaseClient): () => Promise<string> {
  let pending: Promise<string> | null = null

  async function start(): Promise<string> {
    const { data: existing } = await client.auth.getSession()
    if (existing.session) return existing.session.user.id

    const { data, error } = await client.auth.signInAnonymously()
    if (error || !data.user) {
      throw new RepositoryError(
        'unavailable',
        'Couldn’t start a session. Check that anonymous sign-ins are enabled for the project.',
        { cause: error },
      )
    }
    return data.user.id
  }

  return () => {
    pending ??= start().catch((error: unknown) => {
      pending = null // let the next call retry instead of caching the failure
      throw error
    })
    return pending
  }
}

/**
 * Runs one request after making sure there is a session, and turns an error response into a
 * RepositoryError. Network failures (fetch rejecting) are treated like any other error.
 */
export async function unwrap<T>(
  ctx: SupabaseContext,
  request: () => PromiseLike<{ data: T; error: ErrorLike | null }>,
): Promise<T> {
  await ctx.userId()
  let response: { data: T; error: ErrorLike | null }
  try {
    response = await request()
  } catch (cause) {
    throw new RepositoryError('unavailable', 'We couldn’t reach the server. Please try again.', {
      cause,
    })
  }
  if (response.error) throw mapError(response.error)
  return response.data
}
