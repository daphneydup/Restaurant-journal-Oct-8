/**
 * The logic of the `giphy` Edge Function, kept free of Deno-specific code so it can be tested.
 *
 * Why a proxy: Giphy needs an API key on every request. A key in the browser bundle is public
 * to everyone who opens the page, so the key lives in a Supabase secret (GIPHY_API_KEY) and this
 * function adds it on the server. The browser only ever sees trimmed results.
 */

export interface GiphyEnv {
  apiKey: string | undefined
}

export interface GifResult {
  id: string
  title: string
  /** The GIPHY page for this GIF (what to link to when sharing). */
  pageUrl: string
  /** A small version for the picker grid. */
  previewUrl: string
  /** The version to display once chosen. */
  url: string
  width: number
  height: number
}

export const MAX_QUERY_LENGTH = 50
export const MAX_LIMIT = 24
export const DEFAULT_LIMIT = 12
export const MAX_OFFSET = 200

const GIPHY_API = 'https://api.giphy.com/v1/gifs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** Only https URLs on giphy.com hosts are passed on, whatever the upstream sends. */
export function isGiphyUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'giphy.com' || url.hostname.endsWith('.giphy.com'))
    )
  } catch {
    return false
  }
}

interface Rendition {
  url?: unknown
  width?: unknown
  height?: unknown
}

/** Turns one upstream item into our shape, or null when it lacks what we need. */
export function toGif(raw: unknown): GifResult | null {
  if (typeof raw !== 'object' || raw === null) return null
  const item = raw as {
    id?: unknown
    title?: unknown
    url?: unknown
    images?: Record<string, Rendition | undefined>
  }
  const small = item.images?.fixed_width_small
  const full = item.images?.downsized ?? item.images?.fixed_width
  if (typeof item.id !== 'string' || !isGiphyUrl(item.url)) return null
  if (!isGiphyUrl(small?.url) || !isGiphyUrl(full?.url)) return null
  const width = Number(small?.width)
  const height = Number(small?.height)
  return {
    id: item.id,
    title:
      typeof item.title === 'string' && item.title.trim() ? item.title.trim().slice(0, 200) : 'GIF',
    pageUrl: item.url,
    previewUrl: small.url,
    url: full.url,
    width: Number.isFinite(width) && width > 0 ? width : 100,
    height: Number.isFinite(height) && height > 0 ? height : 100,
  }
}

interface Params {
  q: string
  limit: number
  offset: number
}

function parseParams(body: unknown): Params | string {
  const input = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {}
  const q = typeof input.q === 'string' ? input.q.trim() : ''
  if (q.length > MAX_QUERY_LENGTH) return `q must be ${MAX_QUERY_LENGTH} characters or fewer`
  const limit = input.limit === undefined ? DEFAULT_LIMIT : input.limit
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > MAX_LIMIT) {
    return `limit must be a whole number from 1 to ${MAX_LIMIT}`
  }
  const offset = input.offset === undefined ? 0 : input.offset
  if (!Number.isInteger(offset) || (offset as number) < 0 || (offset as number) > MAX_OFFSET) {
    return `offset must be a whole number from 0 to ${MAX_OFFSET}`
  }
  return { q, limit: limit as number, offset: offset as number }
}

/** POST { q?, limit?, offset? } -> { gifs, nextOffset }. An empty `q` returns what is trending. */
export async function handleGiphy(
  req: Request,
  env: GiphyEnv,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  if (!env.apiKey) {
    // Say nothing about the key itself; the operator sees this in the function logs.
    console.error('GIPHY_API_KEY is not set for this function')
    return json({ error: 'not_configured' }, 500)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  const params = parseParams(body)
  if (typeof params === 'string') return json({ error: 'invalid_request', message: params }, 400)

  const query = new URLSearchParams({
    api_key: env.apiKey,
    limit: String(params.limit),
    offset: String(params.offset),
    rating: 'pg',
  })
  if (params.q) {
    query.set('q', params.q)
    query.set('lang', 'en')
  }
  const endpoint = params.q ? 'search' : 'trending'

  let upstream: Response
  try {
    upstream = await fetchImpl(`${GIPHY_API}/${endpoint}?${query}`)
  } catch (error) {
    console.error('Giphy request failed', error instanceof Error ? error.message : error)
    return json({ error: 'upstream_unreachable' }, 502)
  }
  if (!upstream.ok) {
    // 429 means our key hit its rate limit; pass that on so the app can say "try again soon".
    return json(
      { error: upstream.status === 429 ? 'rate_limited' : 'upstream_error' },
      upstream.status === 429 ? 429 : 502,
    )
  }

  let payload: {
    data?: unknown
    pagination?: { total_count?: unknown; count?: unknown; offset?: unknown }
  }
  try {
    payload = await upstream.json()
  } catch {
    return json({ error: 'upstream_error' }, 502)
  }
  const gifs = (Array.isArray(payload.data) ? payload.data : [])
    .map(toGif)
    .filter((gif): gif is GifResult => gif !== null)

  const total = Number(payload.pagination?.total_count)
  const next = params.offset + params.limit
  // Offer more only while Giphy reports more and we're inside the offset we allow.
  const hasMore = Number.isFinite(total)
    ? next < total && next <= MAX_OFFSET
    : gifs.length === params.limit
  return json({ gifs, nextOffset: hasMore && next <= MAX_OFFSET ? next : null })
}
