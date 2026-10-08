import { describe, expect, it } from 'vitest'
import { TEST_NOW } from '@/test/testRepositories'
import { daysBetween, parseISODate } from '@/lib/dates'
import { mockDbSchema } from './db'
import { buildDemoSeed } from './seed/demo'

const seed = buildDemoSeed(TEST_NOW)

describe('demo seed data', () => {
  it('passes the persisted-database schema', () => {
    expect(mockDbSchema.safeParse(seed).success).toBe(true)
  })

  it('has 8 to 10 restaurants across several neighborhoods and every price tier', () => {
    expect(seed.restaurants.length).toBeGreaterThanOrEqual(8)
    expect(seed.restaurants.length).toBeLessThanOrEqual(10)
    expect(new Set(seed.restaurants.map((r) => r.neighborhood)).size).toBeGreaterThanOrEqual(5)
    expect(new Set(seed.restaurants.map((r) => r.priceTier))).toEqual(new Set([1, 2, 3, 4]))
    expect(seed.restaurants.every((r) => r.city === 'Dallas')).toBe(true)
  })

  it('uses unique ids everywhere', () => {
    for (const rows of [
      seed.restaurants,
      seed.visits,
      seed.dishes,
      seed.goBackEntries,
      seed.lenses,
    ]) {
      const ids = rows.map((r) => r.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('has no dangling references', () => {
    const restaurantIds = new Set(seed.restaurants.map((r) => r.id))
    const lensIds = new Set(seed.lenses.map((l) => l.id))
    const visitById = new Map(seed.visits.map((v) => [v.id, v]))

    for (const visit of seed.visits) {
      expect(restaurantIds.has(visit.restaurantId)).toBe(true)
      for (const { lensId } of visit.ratings) expect(lensIds.has(lensId)).toBe(true)
    }
    for (const dish of seed.dishes) {
      expect(restaurantIds.has(dish.restaurantId)).toBe(true)
      for (const lensId of dish.lensIds) expect(lensIds.has(lensId)).toBe(true)
      if (dish.visitId) expect(visitById.get(dish.visitId)?.restaurantId).toBe(dish.restaurantId)
    }
    for (const entry of seed.goBackEntries) expect(restaurantIds.has(entry.restaurantId)).toBe(true)
    for (const lensId of seed.user.defaultLensIds) expect(lensIds.has(lensId)).toBe(true)
  })

  it('has at most one go-back entry per restaurant', () => {
    const ids = seed.goBackEntries.map((g) => g.restaurantId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has varied visit histories, including a never-visited restaurant', () => {
    const counts = seed.restaurants.map(
      (r) => seed.visits.filter((v) => v.restaurantId === r.id).length,
    )
    expect(Math.min(...counts)).toBe(0)
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(3)
  })

  it('includes both order-again and skip dishes', () => {
    expect(new Set(seed.dishes.map((d) => d.verdict))).toEqual(new Set(['order-again', 'skip']))
  })

  it('has diet ratings that include strong matches and weak spots', () => {
    const ratings = seed.visits.flatMap((v) => v.ratings.map((r) => r.rating))
    expect(Math.min(...ratings)).toBeLessThanOrEqual(2)
    expect(Math.max(...ratings)).toBe(5)
  })

  it('dates visits relative to "now" and never in the future', () => {
    for (const visit of seed.visits) {
      expect(daysBetween(parseISODate(visit.date), TEST_NOW)).toBeGreaterThanOrEqual(0)
    }
    const mostRecent = Math.min(
      ...seed.visits.map((v) => daysBetween(parseISODate(v.date), TEST_NOW)),
    )
    expect(mostRecent).toBeLessThan(7)
  })
})
