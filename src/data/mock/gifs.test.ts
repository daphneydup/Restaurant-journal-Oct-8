import { describe, expect, it } from 'vitest'
import { createTestRepositories } from '@/test/testRepositories'
import { gifPageSchema, isAllowedGifUrl } from '@/types'

const { gifs } = createTestRepositories()

describe('demo GIF search', () => {
  it('shows everything when there is no query (the "trending" view)', async () => {
    const page = await gifs.search({ limit: 50 })
    expect(page.gifs.length).toBeGreaterThanOrEqual(10)
    expect(page.nextOffset).toBeNull()
  })

  it('finds by word, ignoring case, and needs every word to match', async () => {
    expect((await gifs.search({ query: 'CHEF' })).gifs.map((g) => g.id)).toEqual(
      expect.arrayContaining(['chefs-kiss', 'bon-appetit']),
    )
    expect((await gifs.search({ query: 'chef kiss' })).gifs.map((g) => g.id)).toEqual([
      'chefs-kiss',
    ])
  })

  it('returns an empty page, not an error, when nothing matches', async () => {
    expect(await gifs.search({ query: 'zzzz' })).toEqual({ gifs: [], nextOffset: null })
  })

  it('pages through the results without repeats or gaps', async () => {
    const all = (await gifs.search({ limit: 50 })).gifs.map((g) => g.id)
    const seen: string[] = []
    let offset: number | null = 0
    let pages = 0
    while (offset !== null) {
      const page = await gifs.search({ limit: 5, offset })
      seen.push(...page.gifs.map((g) => g.id))
      offset = page.nextOffset
      pages++
    }
    expect(seen).toEqual(all)
    expect(pages).toBe(Math.ceil(all.length / 5))
  })

  it('returns results that are valid and safe to store', async () => {
    const page = await gifs.search({ limit: 50 })
    expect(gifPageSchema.safeParse(page).success).toBe(true)
    for (const gif of page.gifs) {
      expect(isAllowedGifUrl(gif.url)).toBe(true)
      expect(gif.title).toMatch(/\S/)
    }
  })

  it('fails like the other repositories when errors are being simulated', async () => {
    const repos = createTestRepositories()
    repos.dev?.setSimulateErrors(true)
    await expect(repos.gifs.search()).rejects.toMatchObject({ code: 'unavailable' })
  })
})
