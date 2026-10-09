import { createSupabaseRepositories } from '@/data/supabase'

export interface RecordedCall {
  method: string
  path: string
  search: URLSearchParams
  headers: Headers
  body: unknown
}

export interface Reply {
  status?: number
  body?: unknown
}

type Responder = Reply | ((call: RecordedCall) => Reply | Promise<Reply>)

const b64 = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
/** A well-formed (unsigned) JWT, which is all the client needs in order to hold a session. */
export const FAKE_TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({
  sub: 'user-1',
  role: 'authenticated',
  is_anonymous: true,
  exp: 4_000_000_000,
})}.signature`

export const FAKE_USER_ID = 'user-1'

/** A Supabase auth user. Defaults to an anonymous guest; pass overrides for a member. */
export function authUserBody(overrides: Record<string, unknown> = {}) {
  return {
    id: FAKE_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    is_anonymous: true,
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-10-08T12:00:00.123456Z',
    ...overrides,
  }
}

/** The body Supabase returns after signing in. */
export function sessionBody(userOverrides: Record<string, unknown> = {}) {
  return {
    access_token: FAKE_TOKEN,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: 4_000_000_000,
    refresh_token: 'refresh-token',
    user: authUserBody(userOverrides),
  }
}

/** A permanent (non-guest) user with a confirmed email. */
export const memberBody = (email = 'summer@example.com', overrides: Record<string, unknown> = {}) =>
  authUserBody({
    is_anonymous: false,
    email,
    email_confirmed_at: '2026-10-08T12:00:00Z',
    ...overrides,
  })

export const URL_BASE = 'https://fake-project.supabase.co'
export const ANON_KEY = 'fake-anon-key'

/**
 * A tiny stand-in for Supabase's HTTP API. It records every request the real supabase-js client
 * makes and answers from routes you register, so tests can assert on exactly what went over the
 * wire and on how replies are mapped. Unmatched requests get a 404 and are still recorded.
 */
export function createFakeSupabase() {
  const calls: RecordedCall[] = []
  const routes: { method: string; path: RegExp; reply: Responder }[] = []

  function on(method: string, path: RegExp, reply: Responder) {
    routes.unshift({ method, path, reply }) // newest registration wins
  }

  const fakeFetch: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    const raw = typeof init?.body === 'string' ? init.body : undefined
    let body: unknown = raw
    try {
      body = raw ? JSON.parse(raw) : undefined
    } catch {
      // keep the raw string
    }
    const call: RecordedCall = {
      method: (init?.method ?? 'GET').toUpperCase(),
      path: url.pathname,
      search: url.searchParams,
      headers: new Headers(init?.headers),
      body,
    }
    calls.push(call)

    const route = routes.find((r) => r.method === call.method && r.path.test(call.path))
    const reply = route
      ? typeof route.reply === 'function'
        ? await route.reply(call)
        : route.reply
      : {
          status: 404,
          body: { code: 'PGRST999', message: `no fake route for ${call.method} ${call.path}` },
        }
    return respond(reply, call.headers)
  }

  /**
   * Mirrors PostgREST: a request that asks for a single object (`.single()`) gets the object
   * itself, and exactly one row must match, otherwise it answers PGRST116 (406).
   */
  function respond(reply: Reply, headers: Headers): Response {
    let { status = 200, body } = reply
    const wantsObject = headers.get('accept')?.includes('vnd.pgrst.object') ?? false
    if (wantsObject && Array.isArray(body) && status < 300) {
      if (body.length === 1) body = body[0]
      else {
        status = 406
        body = {
          code: 'PGRST116',
          message: 'Cannot coerce the result to a single JSON object',
          details: `The result contains ${body.length} rows`,
          hint: null,
        }
      }
    }
    return new Response(body === undefined || body === null ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Anonymous sign-in and sign-out succeed by default.
  on('POST', /\/auth\/v1\/signup$/, () => ({ body: sessionBody() }))
  on('POST', /\/auth\/v1\/logout$/, { status: 204 })

  function repositories() {
    return createSupabaseRepositories({
      url: URL_BASE,
      anonKey: ANON_KEY,
      fetch: fakeFetch,
      persistSession: false,
    })
  }

  /** Calls to the data API (not auth), e.g. ["GET /rest/v1/restaurants"]. */
  const dataCalls = () => calls.filter((c) => c.path.startsWith('/rest/v1/'))
  const signIns = () => calls.filter((c) => c.path.endsWith('/auth/v1/signup'))

  return { calls, on, fetch: fakeFetch, repositories, dataCalls, signIns }
}

export type FakeSupabase = ReturnType<typeof createFakeSupabase>
