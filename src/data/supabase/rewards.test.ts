import { beforeEach, describe, expect, it } from 'vitest'
import { createFakeSupabase, type FakeSupabase } from '@/test/fakeSupabase'
import type { Repositories } from '../repositories'

let fake: FakeSupabase
let repos: Repositories

beforeEach(() => {
  fake = createFakeSupabase()
  repos = fake.repositories()
})

const rpcCalls = (name: string) =>
  fake.dataCalls().filter((c) => c.method === 'POST' && c.path.endsWith(`/rpc/${name}`))

const voucherRow = (over: Record<string, unknown> = {}) => ({
  id: 'v-1',
  user_id: 'u-1', // extra columns are ignored
  reward_id: 'appetizer-ember',
  title: 'Complimentary appetizer',
  partner: 'Ember & Orchard',
  category: 'appetizer',
  code: 'TFE-AB12-CD34',
  points_spent: 150,
  status: 'active',
  created_at: '2026-10-08T19:00:00.123456+00:00',
  expires_at: '2027-01-06T19:00:00.123456+00:00',
  used_at: null,
  ...over,
})

const failWith = (path: RegExp, code: string, message = 'boom') =>
  fake.on('POST', path, { status: 400, body: { code, message } })

describe('summary', () => {
  it('maps the database function’s snake_case result', async () => {
    fake.on('POST', /\/rpc\/get_rewards_summary$/, {
      body: {
        balance: 130,
        lifetime_earned: 250,
        entries: [
          {
            id: 'p-1',
            kind: 'visit',
            points: 50,
            label: 'Visit to Cinder House',
            restaurant_id: 'r-1',
            created_at: '2026-10-08T19:00:00+00:00',
          },
          {
            id: 'p-2',
            kind: 'redeem',
            points: -120,
            label: 'Redeemed: Dessert',
            restaurant_id: null,
            created_at: '2026-10-07T19:00:00+00:00',
          },
        ],
      },
    })
    const summary = await repos.rewards.getSummary()
    expect(summary).toEqual({
      balance: 130,
      lifetimeEarned: 250,
      entries: [
        {
          id: 'p-1',
          kind: 'visit',
          points: 50,
          label: 'Visit to Cinder House',
          restaurantId: 'r-1',
          createdAt: '2026-10-08T19:00:00+00:00',
        },
        {
          id: 'p-2',
          kind: 'redeem',
          points: -120,
          label: 'Redeemed: Dessert',
          restaurantId: null,
          createdAt: '2026-10-07T19:00:00+00:00',
        },
      ],
    })
  })

  it('rejects a ledger line with an unknown kind rather than showing it', async () => {
    fake.on('POST', /\/rpc\/get_rewards_summary$/, {
      body: {
        balance: 0,
        lifetime_earned: 0,
        entries: [
          {
            id: 'p',
            kind: 'gift',
            points: 5,
            label: 'x',
            restaurant_id: null,
            created_at: '2026-10-08T19:00:00+00:00',
          },
        ],
      },
    })
    await expect(repos.rewards.getSummary()).rejects.toMatchObject({ code: 'validation' })
  })
})

describe('catalogue and vouchers', () => {
  it('lists the catalogue ordered by cost', async () => {
    fake.on('GET', /\/rest\/v1\/rewards_catalog$/, {
      body: [
        {
          id: 'drink-marigold',
          title: 'Signature cocktail',
          description: 'One house drink.',
          partner: 'Marigold Social',
          category: 'drink',
          cost: 120,
          active: true,
        },
      ],
    })
    const list = await repos.rewards.listCatalog()
    expect(list).toEqual([
      {
        id: 'drink-marigold',
        title: 'Signature cocktail',
        description: 'One house drink.',
        partner: 'Marigold Social',
        category: 'drink',
        cost: 120,
      },
    ])
    const call = fake.dataCalls().at(-1)!
    expect(call.search.getAll('order')).toEqual(['cost.asc,id.asc'])
  })

  it('lists vouchers newest first, mapping columns', async () => {
    fake.on('GET', /\/rest\/v1\/vouchers$/, { body: [voucherRow()] })
    const [voucher] = await repos.rewards.listVouchers()
    expect(voucher).toEqual({
      id: 'v-1',
      rewardId: 'appetizer-ember',
      title: 'Complimentary appetizer',
      partner: 'Ember & Orchard',
      category: 'appetizer',
      code: 'TFE-AB12-CD34',
      pointsSpent: 150,
      status: 'active',
      createdAt: '2026-10-08T19:00:00.123456+00:00',
      expiresAt: '2027-01-06T19:00:00.123456+00:00',
      usedAt: null,
    })
    expect(fake.dataCalls().at(-1)!.search.getAll('order')).toEqual(['created_at.desc'])
  })
})

describe('redeeming', () => {
  it('calls the redeem function with the reward id and returns the voucher', async () => {
    fake.on('POST', /\/rpc\/redeem_reward$/, { body: voucherRow() })
    const voucher = await repos.rewards.redeem('appetizer-ember')
    expect(voucher.code).toBe('TFE-AB12-CD34')
    expect(rpcCalls('redeem_reward')[0]!.body).toEqual({ p_reward_id: 'appetizer-ember' })
  })

  it('writes nothing to the tables itself: the database function does it all', async () => {
    fake.on('POST', /\/rpc\/redeem_reward$/, { body: voucherRow() })
    await repos.rewards.redeem('appetizer-ember')
    const writes = fake.dataCalls().filter((c) => c.method !== 'GET' && !c.path.includes('/rpc/'))
    expect(writes).toEqual([])
  })

  it.each([
    ['TF001', 'insufficient_points'],
    ['TF006', 'not_found'],
  ])('maps database error %s to %s', async (sqlstate, code) => {
    failWith(/\/rpc\/redeem_reward$/, sqlstate)
    await expect(repos.rewards.redeem('appetizer-ember')).rejects.toMatchObject({ code })
  })

  it('marks a voucher used through its function, and maps its errors', async () => {
    fake.on('POST', /\/rpc\/use_voucher$/, {
      body: voucherRow({ status: 'used', used_at: '2026-10-09T10:00:00+00:00' }),
    })
    expect(await repos.rewards.markVoucherUsed('v-1')).toMatchObject({ status: 'used' })
    expect(rpcCalls('use_voucher')[0]!.body).toEqual({ p_voucher_id: 'v-1' })

    failWith(/\/rpc\/use_voucher$/, 'TF007')
    await expect(repos.rewards.markVoucherUsed('v-1')).rejects.toMatchObject({ code: 'conflict' })
    failWith(/\/rpc\/use_voucher$/, 'TF008')
    await expect(repos.rewards.markVoucherUsed('v-2')).rejects.toMatchObject({ code: 'not_found' })
  })
})

describe('invites', () => {
  it('reads the caller’s own invite', async () => {
    fake.on('POST', /\/rpc\/get_my_referral$/, {
      body: { code: 'TFE-ABCDEF', invited_count: 2, points_earned: 400, has_claimed: true },
    })
    expect(await repos.rewards.getReferral()).toEqual({
      code: 'TFE-ABCDEF',
      invitedCount: 2,
      pointsEarned: 400,
      hasClaimed: true,
    })
  })

  it('claims a normalised code and reports the bonus', async () => {
    fake.on('POST', /\/rpc\/claim_referral$/, { body: { points_awarded: 200 } })
    expect(await repos.rewards.claimReferral('  tfe-abcdef ')).toEqual({ pointsAwarded: 200 })
    expect(rpcCalls('claim_referral')[0]!.body).toEqual({ p_code: 'TFE-ABCDEF' })
  })

  it('refuses malformed codes without calling the network', async () => {
    await expect(repos.rewards.claimReferral('hello')).rejects.toMatchObject({ code: 'validation' })
    expect(rpcCalls('claim_referral')).toHaveLength(0)
  })

  it.each([
    ['TF002', 'not_found'],
    ['TF003', 'conflict'],
    ['TF004', 'validation'],
    ['TF005', 'not_authenticated'],
  ])('maps database error %s to %s', async (sqlstate, code) => {
    failWith(/\/rpc\/claim_referral$/, sqlstate)
    await expect(repos.rewards.claimReferral('TFE-ABCDEF')).rejects.toMatchObject({ code })
  })
})

describe('logging a visit reports points', () => {
  const input = {
    restaurant: { mode: 'existing' as const, restaurantId: 'r-1' },
    visit: {
      date: '2026-10-05',
      ratings: [{ lensId: 'vegan', rating: 5 as const }],
      workedForEveryone: 'yes' as const,
      priceTier: 2 as const,
      companions: [],
      photoUrls: [],
    },
    dishes: [],
    addToGoBack: false,
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
    fake.on('GET', /\/rest\/v1\/visits$/, {
      body: [
        {
          id: 'v-1',
          restaurant_id: 'r-1',
          date: '2026-10-05',
          worked_for_everyone: 'yes',
          price_tier: 2,
          worth_it: null,
          note: null,
          companions: [],
          photo_urls: [],
          created_at: '2026-10-05T19:00:00+00:00',
          visit_ratings: [{ lens_id: 'vegan', rating: 5 }],
        },
      ],
    })
    fake.on('GET', /\/rest\/v1\/dishes$/, { body: [] })
  })

  it('passes through the points the database paid', async () => {
    fake.on('POST', /\/rpc\/log_visit$/, {
      body: { restaurant_id: 'r-1', visit_id: 'v-1', created_restaurant: false, points_earned: 60 },
    })
    expect((await repos.visits.logVisit(input)).pointsEarned).toBe(60)
  })

  it('treats a database without the rewards migration as 0 points, not an error', async () => {
    fake.on('POST', /\/rpc\/log_visit$/, {
      body: { restaurant_id: 'r-1', visit_id: 'v-1', created_restaurant: false },
    })
    expect((await repos.visits.logVisit(input)).pointsEarned).toBe(0)
  })
})
