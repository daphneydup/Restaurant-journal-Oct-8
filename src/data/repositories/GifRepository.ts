import type { GifPage, GifSearchParams } from '@/types'

/**
 * GIF search. With Supabase this goes through the `giphy` Edge Function, which keeps the GIPHY
 * key on the server. Results are small and safe to show: only GIPHY addresses come back.
 * Rejects with `rate_limited` when GIPHY says slow down and `unavailable` for anything else.
 */
export interface GifRepository {
  search(params?: GifSearchParams): Promise<GifPage>
}
