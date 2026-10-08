import { describe, expect, it } from 'vitest'
import { buildSpots } from '@/features/restaurants/spots'
import { createTestRepositories, TEST_NOW } from '@/test/testRepositories'
import { buildGoBackList } from './goBackList'

async function demo() {
  const repos = createTestRepositories()
  const spots = buildSpots(
    await repos.restaurants.list(),
    await repos.visits.list(),
    await repos.goBack.list(),
  )
  return { repos, spots }
}

describe('buildGoBackList', () => {
  it('includes only spots flagged to revisit', async () => {
    const { spots } = await demo()
    const items = buildGoBackList(spots, TEST_NOW)
    expect(items.map((i) => i.restaurant.name).sort()).toEqual([
      'Ember & Orchard',
      'Lantern Alley',
      'Little Fig Kitchen',
      'Saffron & Salt',
      'The Copper Table',
    ])
  })

  it('puts the longest wait first', async () => {
    const { spots } = await demo()
    const items = buildGoBackList(spots, TEST_NOW)
    expect(items.map((i) => i.restaurant.name)).toEqual([
      'The Copper Table', // last visit 210 days ago
      'Saffron & Salt', // 60
      'Lantern Alley', // never visited, saved 14 days ago
      'Ember & Orchard', // 12
      'Little Fig Kitchen', // 8
    ])
    expect(items.map((i) => i.waiting)).toEqual([210, 60, 14, 12, 8])
  })

  it('measures a never-visited spot from the day it was saved', async () => {
    const { spots } = await demo()
    const lantern = buildGoBackList(spots, TEST_NOW).find((i) => i.restaurant.id === 'r-lantern')!
    expect(lantern.daysSinceVisit).toBeNull()
    expect(lantern.daysSinceSaved).toBe(14)
    expect(lantern.waiting).toBe(14)
  })

  it('measures a visited spot from its last visit, not from when it was saved', async () => {
    const { spots } = await demo()
    const copper = buildGoBackList(spots, TEST_NOW).find((i) => i.restaurant.id === 'r-copper')!
    expect(copper.daysSinceVisit).toBe(210)
    expect(copper.daysSinceSaved).toBe(200)
    expect(copper.waiting).toBe(210)
  })

  it('is empty when nothing is flagged', async () => {
    const { repos } = await demo()
    for (const entry of await repos.goBack.list()) await repos.goBack.remove(entry.id)
    const spots = buildSpots(
      await repos.restaurants.list(),
      await repos.visits.list(),
      await repos.goBack.list(),
    )
    expect(buildGoBackList(spots, TEST_NOW)).toEqual([])
  })

  it('moves a spot down the list after you visit it', async () => {
    const { repos } = await demo()
    await repos.visits.logVisit({
      restaurant: { mode: 'existing', restaurantId: 'r-copper' },
      visit: {
        date: '2026-10-07',
        ratings: [{ lensId: 'vegan', rating: 5 }],
        workedForEveryone: 'yes',
        priceTier: 4,
        companions: [],
        photoUrls: [],
      },
      dishes: [],
      addToGoBack: false,
    })
    const spots = buildSpots(
      await repos.restaurants.list(),
      await repos.visits.list(),
      await repos.goBack.list(),
    )
    const items = buildGoBackList(spots, TEST_NOW)
    expect(items.at(-1)!.restaurant.name).toBe('The Copper Table')
    expect(items.at(-1)!.daysSinceVisit).toBe(1)
  })
})
