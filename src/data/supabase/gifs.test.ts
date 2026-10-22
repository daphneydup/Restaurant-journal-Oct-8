import { beforeEach, describe, expect, it } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '@/test/fakeSupabase'
import type { Repositories } from '../repositories'

let fake: FakeSupabase
let repos: Repositories

const gif = (id = 'a') => ({
  id,
  title: `GIF ${id}`,
  pageUrl: `https://giphy.com/gifs/${id}`,
  previewUrl: `https://media.giphy.com/${id}-s.gif`,
  url: `https://media.giphy.com/${id}.gif`,
  width: 100,
  height: 56,
})

const giphyCalls = () => fake.calls.filter((c) => c.path.endsWith('/functions/v1/giphy'))

beforeEach(() => {
  fake = createFakeSupabase()
  repos = fake.repositories()
})

describe('GIF search through the Edge Function', () => {
  it('sends only the words and paging, and returns the page', async () => {
    fake.on('POST', /\/functions\/v1\/giphy$/, { body: { gifs: [gif()], nextOffset: 12 } })
    const page = await repos.gifs.search({ query: '  chef kiss ', limit: 6, offset: 12 })

    expect(page).toEqual({ gifs: [gif()], nextOffset: 12 })
    expect(giphyCalls()).toHaveLength(1)
    expect(giphyCalls()[0]!.body).toEqual({ q: 'chef kiss', limit: 6, offset: 12 })
  })

  it('never sends a GIPHY key: the function adds it on the server', async () => {
    fake.on('POST', /\/functions\/v1\/giphy$/, { body: { gifs: [], nextOffset: null } })
    await repos.gifs.search({ query: 'a' })
    const call = giphyCalls()[0]!
    expect(JSON.stringify(call.body)).not.toMatch(/api_key|key/i)
    expect(call.search.has('api_key')).toBe(false)
  })

  it('sends the person’s session token, which the function’s JWT check needs', async () => {
    fake.on('POST', /\/functions\/v1\/giphy$/, { body: { gifs: [], nextOffset: null } })
    await repos.gifs.search()
    expect(giphyCalls()[0]!.headers.get('authorization')).toMatch(/^Bearer ey/)
  })

  it('defaults to trending: an empty query and the first page', async () => {
    fake.on('POST', /\/functions\/v1\/giphy$/, { body: { gifs: [], nextOffset: null } })
    await repos.gifs.search()
    expect(giphyCalls()[0]!.body).toEqual({ q: '', limit: 12, offset: 0 })
  })

  it('reports GIPHY’s rate limit as rate_limited', async () => {
    fake.on('POST', /\/functions\/v1\/giphy$/, { status: 429, body: { error: 'rate_limited' } })
    await expect(repos.gifs.search({ query: 'a' })).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it.each([500, 502, 401])('reports a %s from the function as unavailable', async (status) => {
    fake.on('POST', /\/functions\/v1\/giphy$/, { status, body: { error: 'x' } })
    await expect(repos.gifs.search({ query: 'a' })).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('refuses a reply that points anywhere but GIPHY', async () => {
    fake.on('POST', /\/functions\/v1\/giphy$/, {
      body: { gifs: [{ ...gif(), url: 'https://evil.example/x.gif' }], nextOffset: null },
    })
    await expect(repos.gifs.search({ query: 'a' })).rejects.toMatchObject({ code: 'validation' })
  })

  it('refuses a reply in the wrong shape', async () => {
    fake.on('POST', /\/functions\/v1\/giphy$/, { body: { hello: 'world' } })
    await expect(repos.gifs.search({ query: 'a' })).rejects.toMatchObject({ code: 'validation' })
  })
})

describe('visits carry their GIF to and from the database', () => {
  const row = {
    id: 'v-1',
    restaurant_id: 'r-1',
    date: '2026-10-05',
    worked_for_everyone: 'yes',
    price_tier: 2,
    worth_it: null,
    note: null,
    companions: [],
    photo_urls: [],
    gif_url: 'https://media.giphy.com/a.gif',
    gif_title: 'Chef kiss',
    created_at: '2026-10-05T19:00:00+00:00',
    visit_ratings: [{ lens_id: 'vegan', rating: 5 }],
  }
  beforeEach(() => {
    fake.on('GET', /\/rest\/v1\/diet_lenses$/, {
      body: [
        {
          id: 'vegan',
          label: 'Vegan',
          short_label: 'Vegan',
          icon: 'leaf',
          kind: 'restriction',
          sort_order: 1,
        },
      ],
    })
  })

  it('reads gif_url and gif_title into the visit', async () => {
    fake.on('GET', /\/rest\/v1\/visits$/, { body: [row] })
    const [visit] = await repos.visits.list()
    expect(visit).toMatchObject({ gifUrl: 'https://media.giphy.com/a.gif', gifTitle: 'Chef kiss' })
  })

  it('leaves them out when the visit has none (and for databases without the columns)', async () => {
    const older: Record<string, unknown> = { ...row }
    delete older.gif_url
    delete older.gif_title
    fake.on('GET', /\/rest\/v1\/visits$/, {
      body: [older, { ...row, id: 'v-2', gif_url: null, gif_title: null }],
    })
    const visits = await repos.visits.list()
    for (const visit of visits) {
      expect('gifUrl' in visit).toBe(false)
      expect('gifTitle' in visit).toBe(false)
    }
  })

  it('writes gif_url and gif_title when a visit is updated, and clears them with null', async () => {
    fake.on('GET', /\/rest\/v1\/visits$/, { body: [row] })
    fake.on('PATCH', /\/rest\/v1\/visits$/, { body: [{ id: 'v-1' }] })
    await repos.visits.update('v-1', {
      gifUrl: 'https://media.giphy.com/b.gif',
      gifTitle: 'Cheers',
    })
    const patch = fake.dataCalls().find((c) => c.method === 'PATCH')!
    expect(patch.body).toMatchObject({
      gif_url: 'https://media.giphy.com/b.gif',
      gif_title: 'Cheers',
    })

    fake.calls.length = 0
    await repos.visits.update('v-1', { gifUrl: undefined, gifTitle: undefined })
    const cleared = fake.dataCalls().find((c) => c.method === 'PATCH')!
    expect(cleared.body).toMatchObject({ gif_url: null, gif_title: null })
  })

  it('passes the GIF to log_visit inside the visit', async () => {
    fake.on('GET', /\/rest\/v1\/restaurants$/, {
      body: [
        {
          id: 'r-1',
          name: 'Spot',
          neighborhood: 'Uptown',
          city: 'Dallas',
          price_tier: 2,
          cuisine: null,
          created_at: '2026-10-01T12:00:00+00:00',
        },
      ],
    })
    fake.on('GET', /\/rest\/v1\/visits$/, { body: [row] })
    fake.on('GET', /\/rest\/v1\/dishes$/, { body: [] })
    fake.on('POST', /\/rpc\/log_visit$/, {
      body: { restaurant_id: 'r-1', visit_id: 'v-1', created_restaurant: false, points_earned: 50 },
    })
    await repos.visits.logVisit({
      restaurant: { mode: 'existing', restaurantId: 'r-1' },
      visit: {
        date: '2026-10-05',
        ratings: [{ lensId: 'vegan', rating: 5 }],
        workedForEveryone: 'yes',
        priceTier: 2,
        companions: [],
        photoUrls: [],
        gifUrl: 'https://media.giphy.com/a.gif',
        gifTitle: 'Chef kiss',
      },
      dishes: [],
      addToGoBack: false,
    })
    const rpc = fake.dataCalls().find((c) => c.path.endsWith('/rpc/log_visit'))!
    expect(rpc.body).toMatchObject({
      p: { visit: { gifUrl: 'https://media.giphy.com/a.gif', gifTitle: 'Chef kiss' } },
    })
  })

  it('refuses to log a visit whose GIF is not on GIPHY, before any network call', async () => {
    await expect(
      repos.visits.logVisit({
        restaurant: { mode: 'existing', restaurantId: 'r-1' },
        visit: {
          date: '2026-10-05',
          ratings: [{ lensId: 'vegan', rating: 5 }],
          workedForEveryone: 'yes',
          priceTier: 2,
          companions: [],
          photoUrls: [],
          gifUrl: 'https://evil.example/x.gif',
          gifTitle: 'x',
        },
        dishes: [],
        addToGoBack: false,
      }),
    ).rejects.toMatchObject({ code: 'validation' })
    expect(fake.dataCalls().some((c) => c.path.endsWith('/rpc/log_visit'))).toBe(false)
  })
})
