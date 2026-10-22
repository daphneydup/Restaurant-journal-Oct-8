import { RepositoryError } from '../errors'
import type { GifRepository } from '../repositories'
import { parseOrThrow } from '../validation'
import { gifPageSchema } from '@/types'
import type { SupabaseContext } from './context'

const UNAVAILABLE = 'We couldn’t load GIFs right now. Please try again.'

/**
 * Searches through the `giphy` Edge Function: the browser sends only the words, and the function
 * adds the GIPHY key on the server. `functions.invoke` sends the person's session token, which
 * is what the function's JWT check expects.
 */
export function createSupabaseGifRepository(ctx: SupabaseContext): GifRepository {
  return {
    async search({ query = '', limit = 12, offset = 0 } = {}) {
      await ctx.userId()
      let response: Awaited<ReturnType<typeof ctx.client.functions.invoke>>
      try {
        response = await ctx.client.functions.invoke('giphy', {
          body: { q: query.trim(), limit, offset },
        })
      } catch (cause) {
        throw new RepositoryError('unavailable', UNAVAILABLE, { cause })
      }
      if (response.error) {
        const status = (response.error as { context?: { status?: number } }).context?.status
        if (status === 429) {
          throw new RepositoryError('rate_limited', 'GIPHY is busy. Try again in a minute.', {
            cause: response.error,
          })
        }
        throw new RepositoryError('unavailable', UNAVAILABLE, { cause: response.error })
      }
      return parseOrThrow(gifPageSchema, response.data)
    },
  }
}
