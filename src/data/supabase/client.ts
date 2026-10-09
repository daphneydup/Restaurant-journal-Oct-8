import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  /** The project's public "anon" key. Safe in the browser: row-level security does the protecting. */
  anonKey: string
  /** Test hooks. */
  fetch?: typeof fetch
  persistSession?: boolean
}

export function createSupabaseClient({
  url,
  anonKey,
  fetch,
  persistSession = true,
}: SupabaseConfig): SupabaseClient {
  return createClient(url, anonKey, {
    // detectSessionInUrl lets the password-reset link in an email sign the user in.
    auth: { persistSession, autoRefreshToken: persistSession, detectSessionInUrl: persistSession },
    // Fail fast. By default a failed read silently retries for about 7 seconds, which on a poor
    // connection looks like a hung screen. The app already retries once and offers "Try again".
    db: { retry: false },
    ...(fetch && { global: { fetch } }),
  })
}
