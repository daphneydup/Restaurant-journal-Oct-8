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
 * Row-level security needs an identity, but a visitor shouldn't have to log in to start. So when
 * there is no session the first request signs in anonymously (a "guest"). Supabase keeps that
 * session in the browser; the guest can later turn it into a real account without losing data.
 *
 * The session is looked up on EVERY call (it is a cheap local read) rather than remembered, so
 * logging out or deleting an account is noticed and the next request starts a fresh guest.
 * Only the sign-in itself is shared, so simultaneous requests start one guest, not several.
 */
export function createSessionProvider(client: SupabaseClient): () => Promise<string> {
  let signingIn: Promise<string> | null = null

  async function startGuest(): Promise<string> {
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

  return async () => {
    const { data } = await client.auth.getSession()
    if (data.session) return data.session.user.id
    signingIn ??= startGuest().finally(() => {
      signingIn = null
    })
    return signingIn
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
