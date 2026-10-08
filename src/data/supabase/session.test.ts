import { describe, expect, it } from 'vitest'
import { ANON_KEY, createFakeSupabase, FAKE_TOKEN } from '@/test/fakeSupabase'

describe('Supabase session', () => {
  it('signs in anonymously on first use, then sends the user’s token and the anon key', async () => {
    const fake = createFakeSupabase()
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [] })
    const repos = fake.repositories()

    await repos.restaurants.list()

    expect(fake.signIns()).toHaveLength(1)
    const [request] = fake.dataCalls()
    expect(request!.headers.get('apikey')).toBe(ANON_KEY)
    expect(request!.headers.get('authorization')).toBe(`Bearer ${FAKE_TOKEN}`)
  })

  it('signs in once even when several requests start at the same time', async () => {
    const fake = createFakeSupabase()
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [] })
    fake.on('GET', /\/rest\/v1\/visits$/, { body: [] })
    fake.on('GET', /\/rest\/v1\/diet_lenses$/, { body: [] }) // visits are ordered by diet
    fake.on('GET', /\/rest\/v1\/go_back_entries$/, { body: [] })
    const repos = fake.repositories()

    await Promise.all([repos.restaurants.list(), repos.visits.list(), repos.goBack.list()])
    expect(fake.signIns()).toHaveLength(1)
  })

  it('reuses the session for later requests', async () => {
    const fake = createFakeSupabase()
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [] })
    const repos = fake.repositories()
    await repos.restaurants.list()
    await repos.restaurants.list()
    expect(fake.signIns()).toHaveLength(1)
  })

  it('reports an unavailable error (and does not call the data API) when sign-in is refused', async () => {
    const fake = createFakeSupabase()
    fake.on('POST', /\/auth\/v1\/signup$/, {
      status: 422,
      body: {
        code: 'anonymous_provider_disabled',
        error_code: 'anonymous_provider_disabled',
        msg: 'Anonymous sign-ins are disabled',
      },
    })
    const repos = fake.repositories()

    await expect(repos.restaurants.list()).rejects.toMatchObject({
      code: 'unavailable',
      message: expect.stringMatching(/anonymous sign-ins are enabled/i),
    })
    expect(fake.dataCalls()).toHaveLength(0)
  })

  it('tries again on the next call after a failed sign-in', async () => {
    const fake = createFakeSupabase()
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [] })
    let attempts = 0
    fake.on('POST', /\/auth\/v1\/signup$/, () => {
      attempts += 1
      return attempts === 1
        ? { status: 500, body: { message: 'boom' } }
        : {
            body: {
              access_token: FAKE_TOKEN,
              token_type: 'bearer',
              expires_in: 3600,
              expires_at: 4_000_000_000,
              refresh_token: 'r',
              user: {
                id: 'user-1',
                aud: 'authenticated',
                role: 'authenticated',
                app_metadata: {},
                user_metadata: {},
                created_at: '2026-10-08T12:00:00Z',
              },
            },
          }
    })
    const repos = fake.repositories()

    await expect(repos.restaurants.list()).rejects.toMatchObject({ code: 'unavailable' })
    await expect(repos.restaurants.list()).resolves.toEqual([])
    expect(attempts).toBe(2)
  })

  it('identifies itself as Supabase-backed and has no demo-data controls', () => {
    const repos = createFakeSupabase().repositories()
    expect(repos.kind).toBe('supabase')
    expect(repos.dev).toBeUndefined()
  })
})
