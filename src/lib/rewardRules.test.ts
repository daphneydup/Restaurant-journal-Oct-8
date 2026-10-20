import { describe, expect, it } from 'vitest'
import type { PointsEntry } from '@/types'
import { REWARD_CATALOG } from './rewardsCatalog'
import {
  LIMITS,
  POINTS,
  awardForVisit,
  balanceOf,
  codeFromId,
  lifetimeEarnedOf,
  pointsToNextReward,
  referralCodeFromId,
  visitPoints,
  voucherState,
} from './rewardRules'
import { REFERRAL_CODE_PATTERN } from '@/types'

const NOW = new Date('2026-10-08T15:00:00.000Z')

const entry = (over: Partial<PointsEntry> = {}): PointsEntry => ({
  id: 'e',
  kind: 'visit',
  points: 50,
  label: 'Visit',
  restaurantId: 'r-1',
  createdAt: '2026-10-08T09:00:00.000Z',
  ...over,
})

const plain = { note: undefined, photoUrls: [] as string[] }
const award = (ledger: PointsEntry[], restaurantId = 'r-2', visit = plain) =>
  awardForVisit({ visit, restaurantId, restaurantName: 'Spot', ledger, now: NOW })

describe('visitPoints', () => {
  it('pays the base for a plain visit', () => {
    expect(visitPoints(plain)).toBe(POINTS.visit)
  })
  it('adds a bonus for a note and another for a photo', () => {
    expect(visitPoints({ note: 'Great', photoUrls: [] })).toBe(POINTS.visit + POINTS.note)
    expect(visitPoints({ note: undefined, photoUrls: ['x'] })).toBe(POINTS.visit + POINTS.photo)
    expect(visitPoints({ note: 'Great', photoUrls: ['x'] })).toBe(
      POINTS.visit + POINTS.note + POINTS.photo,
    )
  })
  it('does not pay a bonus for a blank note', () => {
    expect(visitPoints({ note: '   ', photoUrls: [] })).toBe(POINTS.visit)
  })
})

describe('awardForVisit daily limits', () => {
  it('awards a visit when nothing has been earned today', () => {
    expect(award([])).toEqual({ points: POINTS.visit, label: 'Visit to Spot' })
  })

  it(`stops after ${LIMITS.visitsPerDay} paid visits in a day`, () => {
    const today = Array.from({ length: LIMITS.visitsPerDay }, (_, i) =>
      entry({ id: `e${i}`, restaurantId: `r-other-${i}` }),
    )
    expect(award(today)).toBeNull()
    expect(award(today.slice(1))).not.toBeNull() // one fewer: still paid
  })

  it('pays only the first visit to a restaurant each day', () => {
    expect(award([entry({ restaurantId: 'r-2' })], 'r-2')).toBeNull()
    expect(award([entry({ restaurantId: 'r-1' })], 'r-2')).not.toBeNull()
  })

  it('does not count yesterday’s visits, or redemptions and invites, against today', () => {
    const old = entry({ createdAt: '2026-10-07T23:59:59.000Z', restaurantId: 'r-2' })
    const other = [
      entry({ kind: 'redeem', points: -100, restaurantId: null }),
      entry({ kind: 'invite', points: 200, restaurantId: null }),
      entry({ kind: 'joined', points: 200, restaurantId: null }),
    ]
    expect(award([old, ...other, old, old, old], 'r-2')).not.toBeNull()
  })

  it('counts days in UTC, so the boundary is the same everywhere', () => {
    const justAfterMidnight = new Date('2026-10-09T00:00:01.000Z')
    const result = awardForVisit({
      visit: plain,
      restaurantId: 'r-1',
      restaurantName: 'Spot',
      ledger: [entry({ createdAt: '2026-10-08T23:59:59.000Z' })],
      now: justAfterMidnight,
    })
    expect(result).not.toBeNull()
  })
})

describe('ledger arithmetic', () => {
  const ledger = [
    entry({ points: 50 }),
    entry({ points: 200, kind: 'invite' }),
    entry({ kind: 'redeem', points: -120 }),
  ]
  it('balance is the sum of every line', () => expect(balanceOf(ledger)).toBe(130))
  it('lifetime earned ignores spending', () => expect(lifetimeEarnedOf(ledger)).toBe(250))
})

describe('voucherState', () => {
  const base = { status: 'active' as const, expiresAt: '2026-11-01T00:00:00.000Z' }
  it('is active before the expiry date', () => expect(voucherState(base, NOW)).toBe('active'))
  it('is expired on and after the expiry date', () => {
    expect(voucherState({ ...base, expiresAt: NOW.toISOString() }, NOW)).toBe('expired')
    expect(voucherState({ ...base, expiresAt: '2026-10-01T00:00:00.000Z' }, NOW)).toBe('expired')
  })
  it('a used voucher stays used even after its date', () => {
    expect(voucherState({ status: 'used', expiresAt: '2026-10-01T00:00:00.000Z' }, NOW)).toBe(
      'used',
    )
  })
})

describe('codes', () => {
  it('makes referral codes that match the public pattern, for any id', () => {
    for (const id of ['test-id-1', 'a1b2c3d4-0000-4000-8000-123456789abc', '', '----']) {
      expect(referralCodeFromId(id)).toMatch(REFERRAL_CODE_PATTERN)
    }
  })
  it('never uses easily confused characters', () => {
    expect(codeFromId('0O1Il0O1Il0O1Il', 40)).not.toMatch(/[01OIL]/)
  })
  it('is deterministic, and different ids usually give different codes', () => {
    expect(codeFromId('abc', 6)).toBe(codeFromId('abc', 6))
    expect(codeFromId('abcdef', 6)).not.toBe(codeFromId('uvwxyz', 6))
  })
})

describe('pointsToNextReward', () => {
  it('is the gap to the cheapest perk not yet affordable', () => {
    expect(pointsToNextReward(130, [120, 150, 500])).toBe(20)
  })
  it('is null when everything is affordable', () => {
    expect(pointsToNextReward(10_000, [120, 150])).toBeNull()
  })
})

describe('the catalogue', () => {
  it('has unique ids and positive whole costs', () => {
    expect(new Set(REWARD_CATALOG.map((r) => r.id)).size).toBe(REWARD_CATALOG.length)
    expect(REWARD_CATALOG.every((r) => Number.isInteger(r.cost) && r.cost > 0)).toBe(true)
  })
  it('offers free appetizers, drinks and food, plus discounts', () => {
    const categories = new Set(REWARD_CATALOG.map((r) => r.category))
    for (const needed of ['appetizer', 'drink', 'entree', 'discount']) {
      expect(categories.has(needed as never)).toBe(true)
    }
  })
  it('matches the costs seeded in the Supabase migration', async () => {
    const sql = (await import('../../supabase/migrations/20261020000000_rewards.sql?raw')).default
    for (const reward of REWARD_CATALOG) {
      expect(sql).toContain(`'${reward.id}'`)
      expect(sql).toMatch(new RegExp(`'${reward.id}'[^\\n]*,\\s*${reward.cost}\\)`))
    }
  })
})
