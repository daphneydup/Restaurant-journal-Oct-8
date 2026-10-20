import { describe, expect, it } from 'vitest'
import { TEST_NOW, createTestRepositories } from '@/test/testRepositories'
import { POINTS, balanceOf } from '@/lib/rewardRules'
import { REWARD_CATALOG } from '@/lib/rewardsCatalog'
import type { LogVisitInput } from '@/types'
import { createMockRepositories } from '.'
import { MOCK_DB_VERSION, mockDbSchema } from './db'
import { buildDemoSeed } from './seed/demo'
import { createMockStore } from './store'

const logInput = (
  over: Partial<LogVisitInput['visit']> = {},
  restaurantId = 'r-noodle',
): LogVisitInput => ({
  restaurant: { mode: 'existing', restaurantId },
  visit: {
    date: '2026-10-08',
    ratings: [{ lensId: 'vegan', rating: 5 }],
    workedForEveryone: 'yes',
    priceTier: 2,
    companions: [],
    photoUrls: [],
    ...over,
  },
  dishes: [],
  addToGoBack: false,
})

/** A fresh, empty-ledger person, so balances are easy to reason about. */
function emptyRepos(now = () => TEST_NOW) {
  const repos = createTestRepositories({
    now,
    seed: (at) => {
      const seed = buildDemoSeed(at)
      return {
        ...seed,
        rewards: { ledger: [], vouchers: [], referralCode: null, claimedCode: null },
      }
    },
  })
  return repos
}

describe('the seed', () => {
  const seed = buildDemoSeed(TEST_NOW)
  it('passes the schema at the current version', () => {
    expect(MOCK_DB_VERSION).toBe(2)
    expect(mockDbSchema.safeParse(seed).success).toBe(true)
  })
  it('gives the demo person a balance worth spending, with one used and one live voucher', () => {
    expect(balanceOf(seed.rewards.ledger)).toBeGreaterThan(500)
    expect(seed.rewards.vouchers.map((v) => v.status).sort()).toEqual(['active', 'used'])
  })
  it('keeps the ledger consistent with the vouchers it paid for', () => {
    for (const voucher of seed.rewards.vouchers) {
      expect(
        seed.rewards.ledger.some((e) => e.kind === 'redeem' && e.points === -voucher.pointsSpent),
      ).toBe(true)
    }
  })
})

describe('earning points for visits', () => {
  it('pays for a logged visit and reports it', async () => {
    const repos = emptyRepos()
    const result = await repos.visits.logVisit(logInput())
    expect(result.pointsEarned).toBe(POINTS.visit)
    const summary = await repos.rewards.getSummary()
    expect(summary).toMatchObject({ balance: POINTS.visit, lifetimeEarned: POINTS.visit })
    expect(summary.entries[0]).toMatchObject({
      kind: 'visit',
      restaurantId: 'r-noodle',
      label: 'Visit to Noodle & Nori',
    })
  })

  it('pays bonuses for a note and a photo', async () => {
    const repos = emptyRepos()
    const result = await repos.visits.logVisit(
      logInput({ note: 'Lovely', photoUrls: ['data:image/jpeg;base64,xx'] }),
    )
    expect(result.pointsEarned).toBe(POINTS.visit + POINTS.note + POINTS.photo)
  })

  it('pays only the first visit to a restaurant in a day, and says 0 for the rest', async () => {
    const repos = emptyRepos()
    await repos.visits.logVisit(logInput())
    const second = await repos.visits.logVisit(logInput())
    expect(second.pointsEarned).toBe(0)
    expect((await repos.rewards.getSummary()).balance).toBe(POINTS.visit)
  })

  it('stops paying after three visits in a day', async () => {
    const repos = emptyRepos()
    const spots = ['r-noodle', 'r-fig', 'r-ember', 'r-cinder']
    const earned: number[] = []
    for (const id of spots)
      earned.push((await repos.visits.logVisit(logInput({}, id))).pointsEarned)
    expect(earned).toEqual([POINTS.visit, POINTS.visit, POINTS.visit, 0])
  })

  it('does not let deleting and re-logging a visit earn twice', async () => {
    const repos = emptyRepos()
    const first = await repos.visits.logVisit(logInput())
    await repos.visits.remove(first.visit.id)
    const again = await repos.visits.logVisit(logInput())
    expect(again.pointsEarned).toBe(0)
    expect((await repos.rewards.getSummary()).balance).toBe(POINTS.visit)
  })

  it('pays again the next day', async () => {
    let now = TEST_NOW
    const repos = emptyRepos(() => now)
    await repos.visits.logVisit(logInput())
    now = new Date(TEST_NOW.getTime() + 24 * 60 * 60 * 1000)
    expect((await repos.visits.logVisit(logInput())).pointsEarned).toBe(POINTS.visit)
  })

  it('also pays for a visit saved with create()', async () => {
    const repos = emptyRepos()
    const { visit } = await repos.visits.logVisit(logInput({}, 'r-fig'))
    await repos.visits.create({ ...visit, restaurantId: 'r-noodle' })
    expect((await repos.rewards.getSummary()).balance).toBe(POINTS.visit * 2)
  })

  it('pays nothing for a visit that fails validation', async () => {
    const repos = emptyRepos()
    await expect(repos.visits.logVisit(logInput({ ratings: [] }))).rejects.toMatchObject({
      code: 'validation',
    })
    expect((await repos.rewards.getSummary()).balance).toBe(0)
  })
})

describe('redeeming', () => {
  const cheapest = [...REWARD_CATALOG].sort((a, b) => a.cost - b.cost)[0]!

  it('lists the catalogue cheapest first', async () => {
    const list = await createTestRepositories().rewards.listCatalog()
    expect(list.map((r) => r.cost)).toEqual([...list.map((r) => r.cost)].sort((a, b) => a - b))
    expect(list).toHaveLength(REWARD_CATALOG.length)
  })

  it('spends points and hands back a voucher with a code, atomically', async () => {
    const repos = createTestRepositories()
    const before = (await repos.rewards.getSummary()).balance
    const voucher = await repos.rewards.redeem(cheapest.id)

    expect(voucher).toMatchObject({
      rewardId: cheapest.id,
      title: cheapest.title,
      partner: cheapest.partner,
      pointsSpent: cheapest.cost,
      status: 'active',
      usedAt: null,
    })
    expect(voucher.code).toMatch(/^TFE-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect(new Date(voucher.expiresAt).getTime()).toBeGreaterThan(TEST_NOW.getTime())

    const after = await repos.rewards.getSummary()
    expect(after.balance).toBe(before - cheapest.cost)
    expect(after.lifetimeEarned).toBeGreaterThan(0)
    expect(after.entries[0]).toMatchObject({ kind: 'redeem', points: -cheapest.cost })
    expect((await repos.rewards.listVouchers()).map((v) => v.id)).toContain(voucher.id)
  })

  it('refuses when the balance is too low, and changes nothing', async () => {
    const repos = emptyRepos()
    await expect(repos.rewards.redeem(cheapest.id)).rejects.toMatchObject({
      code: 'insufficient_points',
    })
    expect((await repos.rewards.getSummary()).balance).toBe(0)
    expect(await repos.rewards.listVouchers()).toEqual([])
  })

  it('allows spending exactly the whole balance, but not one point more', async () => {
    const exact = createTestRepositories({
      seed: (at) => ({
        ...buildDemoSeed(at),
        rewards: {
          ledger: [
            {
              id: 'x',
              kind: 'invite',
              points: cheapest.cost,
              label: 'Gift',
              restaurantId: null,
              createdAt: at.toISOString(),
            },
          ],
          vouchers: [],
          referralCode: null,
          claimedCode: null,
        },
      }),
    })
    await exact.rewards.redeem(cheapest.id)
    expect((await exact.rewards.getSummary()).balance).toBe(0)
    await expect(exact.rewards.redeem(cheapest.id)).rejects.toMatchObject({
      code: 'insufficient_points',
    })
  })

  it('rejects an unknown reward', async () => {
    await expect(createTestRepositories().rewards.redeem('nope')).rejects.toMatchObject({
      code: 'not_found',
    })
  })

  it('marks a voucher used once, and then reports a conflict', async () => {
    const repos = createTestRepositories()
    const voucher = await repos.rewards.redeem(cheapest.id)
    const used = await repos.rewards.markVoucherUsed(voucher.id)
    expect(used).toMatchObject({ status: 'used', usedAt: TEST_NOW.toISOString() })
    await expect(repos.rewards.markVoucherUsed(voucher.id)).rejects.toMatchObject({
      code: 'conflict',
    })
    await expect(repos.rewards.markVoucherUsed('ghost')).rejects.toMatchObject({
      code: 'not_found',
    })
  })

  it('lists vouchers newest first', async () => {
    const repos = createTestRepositories()
    const a = await repos.rewards.redeem(cheapest.id)
    const list = await repos.rewards.listVouchers()
    expect(list[0]?.id === a.id || list[0]!.createdAt >= list[1]!.createdAt).toBe(true)
    const times = list.map((v) => v.createdAt)
    expect(times).toEqual([...times].sort().reverse())
  })

  it('returns copies, so callers cannot edit the store', async () => {
    const repos = createTestRepositories()
    const summary = await repos.rewards.getSummary()
    summary.entries.length = 0
    expect((await repos.rewards.getSummary()).entries.length).toBeGreaterThan(0)
  })
})

describe('invites', () => {
  it('gives each person a stable invite code in the public format', async () => {
    const repos = createTestRepositories()
    const first = await repos.rewards.getReferral()
    expect(first.code).toMatch(/^TFE-[A-HJKMNP-Z2-9]{6}$/)
    expect((await repos.rewards.getReferral()).code).toBe(first.code)
  })

  it('counts the friends who joined and the points they earned', async () => {
    const referral = await createTestRepositories().rewards.getReferral()
    expect(referral).toMatchObject({
      invitedCount: 1,
      pointsEarned: POINTS.referral,
      hasClaimed: false,
    })
  })

  it('refuses a guest', async () => {
    const repos = createTestRepositories()
    await expect(repos.rewards.claimReferral('TFE-ABCDEF')).rejects.toMatchObject({
      code: 'not_authenticated',
    })
  })

  async function member() {
    const repos = emptyRepos()
    await repos.auth.signUp({ email: 'a@example.com', password: 'correct-horse' })
    return repos
  }

  it('pays the welcome bonus to a member, once', async () => {
    const repos = await member()
    expect(await repos.rewards.claimReferral(' tfe-abcdef ')).toEqual({
      pointsAwarded: POINTS.referral,
    })
    const summary = await repos.rewards.getSummary()
    expect(summary.balance).toBe(POINTS.referral)
    expect(summary.entries[0]).toMatchObject({ kind: 'joined', points: POINTS.referral })
    expect((await repos.rewards.getReferral()).hasClaimed).toBe(true)
    await expect(repos.rewards.claimReferral('TFE-GHJKMN')).rejects.toMatchObject({
      code: 'conflict',
    })
    expect((await repos.rewards.getSummary()).balance).toBe(POINTS.referral)
  })

  it('refuses your own code', async () => {
    const repos = await member()
    const { code } = await repos.rewards.getReferral()
    await expect(repos.rewards.claimReferral(code)).rejects.toMatchObject({ code: 'validation' })
    expect((await repos.rewards.getSummary()).balance).toBe(0)
  })

  it('refuses text that is not an invite code', async () => {
    const repos = await member()
    for (const bad of ['', 'hello', 'TFE-12', 'TFE-ABCDE0', 'XYZ-ABCDEF']) {
      await expect(repos.rewards.claimReferral(bad)).rejects.toMatchObject({ code: 'validation' })
    }
  })
})

describe('wiping an account', () => {
  it('removes points, vouchers and invite state along with the journal', async () => {
    const store = createMockStore({ latencyMs: 0, storage: null, now: () => TEST_NOW })
    expect(store.read().rewards.ledger.length).toBeGreaterThan(0)
    store.wipe()
    expect(store.read().rewards).toEqual({
      ledger: [],
      vouchers: [],
      referralCode: null,
      claimedCode: null,
    })
  })

  it('persists rewards across reloads', async () => {
    const storage = new Map<string, string>()
    const adapter = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    }
    const opts = { latencyMs: 0, storage: adapter, now: () => TEST_NOW }
    const a = createMockRepositories(opts)
    const voucher = await a.rewards.redeem(REWARD_CATALOG[0]!.id)
    const b = createMockRepositories(opts)
    expect((await b.rewards.listVouchers()).map((v) => v.id)).toContain(voucher.id)
  })
})
