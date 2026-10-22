import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_OFFSET,
  MAX_QUERY_LENGTH,
  handleGiphy,
  isGiphyUrl,
  toGif,
} from '../../../supabase/functions/giphy/handler'

const KEY = 'secret-key-123'

const item = (over: Record<string, unknown> = {}) => ({
  id: 'abc',
  title: 'Chef kiss GIF',
  url: 'https://giphy.com/gifs/chef-kiss-abc',
  images: {
    fixed_width_small: { url: 'https://media2.giphy.com/s.gif', width: '100', height: '56' },
    downsized: { url: 'https://media2.giphy.com/d.gif', width: '480', height: '270' },
    fixed_width: { url: 'https://media2.giphy.com/f.gif', width: '200', height: '112' },
  },
  ...over,
})

const giphyReply = (data: unknown[], total = 100, status = 200) =>
  new Response(JSON.stringify({ data, pagination: { total_count: total } }), { status })

function post(body: unknown, init: RequestInit = {}) {
  return new Request('https://x.supabase.co/functions/v1/giphy', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  })
}

afterEach(() => vi.restoreAllMocks())

describe('isGiphyUrl', () => {
  it.each([
    ['https://media.giphy.com/a.gif', true],
    ['https://giphy.com/gifs/x', true],
    ['http://media.giphy.com/a.gif', false],
    ['https://evilgiphy.com/a.gif', false],
    ['https://giphy.com.evil.com/a.gif', false],
    ['javascript:alert(1)', false],
    ['data:image/gif;base64,AAAA', false],
    ['not a url', false],
    [42, false],
  ])('%s -> %s', (value, expected) => expect(isGiphyUrl(value)).toBe(expected))
})

describe('toGif', () => {
  it('trims an upstream item to what the app needs', () => {
    expect(toGif(item())).toEqual({
      id: 'abc',
      title: 'Chef kiss GIF',
      pageUrl: 'https://giphy.com/gifs/chef-kiss-abc',
      previewUrl: 'https://media2.giphy.com/s.gif',
      url: 'https://media2.giphy.com/d.gif',
      width: 100,
      height: 56,
    })
  })
  it('falls back to the fixed-width version when there is no downsized one', () => {
    const images = { ...item().images, downsized: undefined }
    expect(toGif(item({ images }))?.url).toBe('https://media2.giphy.com/f.gif')
  })
  it('gives an untitled GIF a name, and keeps long titles reasonable', () => {
    expect(toGif(item({ title: '  ' }))?.title).toBe('GIF')
    expect(toGif(item({ title: 'x'.repeat(500) }))?.title).toHaveLength(200)
  })
  it.each([
    ['no id', { id: undefined }],
    ['a page URL off giphy.com', { url: 'https://evil.com/p' }],
    [
      'a preview off giphy.com',
      { images: { ...item().images, fixed_width_small: { url: 'https://evil.com/s.gif' } } },
    ],
    ['no images', { images: undefined }],
  ])('drops an item with %s', (_name, over) => expect(toGif(item(over))).toBeNull())
  it('drops non-objects', () => {
    expect(toGif(null)).toBeNull()
    expect(toGif('gif')).toBeNull()
  })
  it('uses safe sizes when the upstream sizes are nonsense', () => {
    const g = toGif(
      item({
        images: {
          ...item().images,
          fixed_width_small: { url: 'https://media.giphy.com/s.gif', width: 'x', height: '0' },
        },
      }),
    )
    expect(g).toMatchObject({ width: 100, height: 100 })
  })
})

describe('handleGiphy: requests', () => {
  it('answers the browser’s preflight check', async () => {
    const res = await handleGiphy(new Request('https://x/giphy', { method: 'OPTIONS' }), {
      apiKey: KEY,
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('authorization')
  })

  it('only accepts POST', async () => {
    const res = await handleGiphy(new Request('https://x/giphy', { method: 'GET' }), {
      apiKey: KEY,
    })
    expect(res.status).toBe(405)
  })

  it('reports a missing key as a server problem without revealing anything', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchMock = vi.fn()
    const res = await handleGiphy(post({ q: 'pasta' }), { apiKey: undefined }, fetchMock)
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['not JSON', 'nope'],
    ['a query over the limit', { q: 'x'.repeat(MAX_QUERY_LENGTH + 1) }],
    ['a limit of zero', { limit: 0 }],
    ['a limit that is too big', { limit: MAX_LIMIT + 1 }],
    ['a fractional limit', { limit: 2.5 }],
    ['a text limit', { limit: '5' }],
    ['a negative offset', { offset: -1 }],
    ['an offset that is too big', { offset: MAX_OFFSET + 1 }],
  ])('rejects %s without calling Giphy', async (_name, body) => {
    const fetchMock = vi.fn()
    const res = await handleGiphy(post(body), { apiKey: KEY }, fetchMock)
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('handleGiphy: talking to Giphy', () => {
  it('searches when there is a query, with the key added on the server and a PG rating', async () => {
    const fetchMock = vi.fn().mockResolvedValue(giphyReply([item()]))
    const res = await handleGiphy(
      post({ q: '  chef kiss ', limit: 6, offset: 12 }),
      { apiKey: KEY },
      fetchMock,
    )
    const url = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(url.origin + url.pathname).toBe('https://api.giphy.com/v1/gifs/search')
    expect(url.searchParams.get('q')).toBe('chef kiss')
    expect(url.searchParams.get('api_key')).toBe(KEY)
    expect(url.searchParams.get('limit')).toBe('6')
    expect(url.searchParams.get('offset')).toBe('12')
    expect(url.searchParams.get('rating')).toBe('pg')
    expect(res.status).toBe(200)
  })

  it('shows what is trending when there is no query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(giphyReply([item()]))
    await handleGiphy(post({}), { apiKey: KEY }, fetchMock)
    const url = new URL(fetchMock.mock.calls[0]![0] as string)
    expect(url.pathname).toBe('/v1/gifs/trending')
    expect(url.searchParams.has('q')).toBe(false)
    expect(url.searchParams.get('limit')).toBe(String(DEFAULT_LIMIT))
  })

  it('never puts the key in anything sent back to the browser', async () => {
    const res = await handleGiphy(
      post({ q: 'a' }),
      { apiKey: KEY },
      vi.fn().mockResolvedValue(giphyReply([item()])),
    )
    expect(JSON.stringify(await res.json())).not.toContain(KEY)
  })

  it('returns trimmed results with CORS headers, skipping unusable items', async () => {
    const reply = giphyReply([
      item(),
      item({ id: 'bad', url: 'https://evil.com/x' }),
      item({ id: 'two' }),
    ])
    const res = await handleGiphy(
      post({ q: 'a' }),
      { apiKey: KEY },
      vi.fn().mockResolvedValue(reply),
    )
    const body = await res.json()
    expect(body.gifs.map((g: { id: string }) => g.id)).toEqual(['abc', 'two'])
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('says where the next page starts, and stops when there is no more', async () => {
    const more = await handleGiphy(
      post({ q: 'a', limit: 12, offset: 0 }),
      { apiKey: KEY },
      vi.fn().mockResolvedValue(giphyReply([item()], 100)),
    )
    expect((await more.json()).nextOffset).toBe(12)
    const last = await handleGiphy(
      post({ q: 'a', limit: 12, offset: 96 }),
      { apiKey: KEY },
      vi.fn().mockResolvedValue(giphyReply([item()], 100)),
    )
    expect((await last.json()).nextOffset).toBeNull()
  })

  it('does not offer pages beyond the offset it allows', async () => {
    const res = await handleGiphy(
      post({ q: 'a', limit: 24, offset: MAX_OFFSET - 10 }),
      { apiKey: KEY },
      vi.fn().mockResolvedValue(giphyReply([item()], 5000)),
    )
    expect((await res.json()).nextOffset).toBeNull()
  })

  it('passes on a rate limit so the app can say "try again soon"', async () => {
    const res = await handleGiphy(
      post({ q: 'a' }),
      { apiKey: KEY },
      vi.fn().mockResolvedValue(new Response('', { status: 429 })),
    )
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'rate_limited' })
  })

  it('reports other upstream failures, and unreachable networks, as a bad gateway', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = await handleGiphy(
      post({ q: 'a' }),
      { apiKey: KEY },
      vi.fn().mockResolvedValue(new Response('', { status: 500 })),
    )
    expect(broken.status).toBe(502)
    const down = await handleGiphy(
      post({ q: 'a' }),
      { apiKey: KEY },
      vi.fn().mockRejectedValue(new Error('offline')),
    )
    expect(down.status).toBe(502)
    expect(await down.json()).toEqual({ error: 'upstream_unreachable' })
    const garbled = await handleGiphy(
      post({ q: 'a' }),
      { apiKey: KEY },
      vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })),
    )
    expect(garbled.status).toBe(502)
  })

  it('survives an upstream reply with no data', async () => {
    const res = await handleGiphy(
      post({ q: 'a' }),
      { apiKey: KEY },
      vi.fn().mockResolvedValue(new Response('{}', { status: 200 })),
    )
    expect((await res.json()).gifs).toEqual([])
  })
})
