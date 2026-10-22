import { describe, expect, it } from 'vitest'
import { gifPageSchema, isAllowedGifUrl } from './gif'
import { visitInputSchema } from './visit'

describe('isAllowedGifUrl', () => {
  it.each([
    ['https://media2.giphy.com/media/abc/giphy.gif', true],
    ['https://giphy.com/gifs/abc', true],
    ['data:image/svg+xml;utf8,%3Csvg%3E%3C%2Fsvg%3E', true],
    ['http://media.giphy.com/a.gif', false],
    ['https://giphy.com.evil.example/a.gif', false],
    ['https://notgiphy.com/a.gif', false],
    ['https://example.com/a.gif', false],
    ['javascript:alert(1)', false],
    ['data:text/html,<script>alert(1)</script>', false],
    ['data:image/png;base64,AAAA', false],
    ['', false],
  ])('%s -> %s', (value, expected) => expect(isAllowedGifUrl(value)).toBe(expected))

  it('refuses an enormous inline picture', () => {
    expect(isAllowedGifUrl(`data:image/svg+xml;utf8,${'a'.repeat(25_000)}`)).toBe(false)
  })
})

describe('visits with a GIF', () => {
  const base = {
    restaurantId: 'r-1',
    date: '2026-10-08',
    ratings: [{ lensId: 'vegan', rating: 5 as const }],
    workedForEveryone: 'yes' as const,
    priceTier: 2 as const,
    companions: [],
    photoUrls: [],
  }
  it('accepts a GIPHY GIF with a title, and no GIF at all', () => {
    expect(visitInputSchema.safeParse(base).success).toBe(true)
    expect(
      visitInputSchema.safeParse({
        ...base,
        gifUrl: 'https://media.giphy.com/a.gif',
        gifTitle: 'Chef kiss',
      }).success,
    ).toBe(true)
  })
  it('refuses a GIF address on another site, so a visit can’t load arbitrary files', () => {
    const result = visitInputSchema.safeParse({ ...base, gifUrl: 'https://evil.example/x.gif' })
    expect(result.success).toBe(false)
  })
  it('refuses an empty title', () => {
    expect(
      visitInputSchema.safeParse({
        ...base,
        gifUrl: 'https://media.giphy.com/a.gif',
        gifTitle: ' ',
      }).success,
    ).toBe(false)
  })
})

describe('gifPageSchema', () => {
  const gif = {
    id: 'a',
    title: 'A',
    pageUrl: 'https://giphy.com/gifs/a',
    previewUrl: 'https://media.giphy.com/s.gif',
    url: 'https://media.giphy.com/f.gif',
    width: 100,
    height: 50,
  }
  it('parses a page and allows "no more"', () => {
    expect(gifPageSchema.parse({ gifs: [gif], nextOffset: null }).nextOffset).toBeNull()
  })
  it('rejects a result that points off GIPHY', () => {
    expect(
      gifPageSchema.safeParse({
        gifs: [{ ...gif, url: 'https://evil.example/f.gif' }],
        nextOffset: 0,
      }).success,
    ).toBe(false)
  })
})
