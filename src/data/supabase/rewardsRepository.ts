import { z } from 'zod'
import type { RewardsRepository } from '../repositories'
import { parseOrThrow } from '../validation'
import {
  referralCodeSchema,
  referralInfoSchema,
  rewardSchema,
  rewardsSummarySchema,
  voucherSchema,
  type PointsEntry,
  type Voucher,
} from '@/types'
import { unwrap, type SupabaseContext } from './context'
import { toList } from './rows'

const ledgerRow = z.object({
  id: z.string(),
  kind: z.string(),
  points: z.number(),
  label: z.string(),
  restaurant_id: z.string().nullable(),
  created_at: z.string(),
})

const summaryRow = z.object({
  balance: z.number(),
  lifetime_earned: z.number(),
  entries: z.array(ledgerRow),
})

const catalogRow = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  partner: z.string(),
  category: z.string(),
  cost: z.number(),
})

const voucherRow = z.object({
  id: z.string(),
  reward_id: z.string(),
  title: z.string(),
  partner: z.string(),
  category: z.string(),
  code: z.string(),
  points_spent: z.number(),
  status: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
  used_at: z.string().nullable(),
})

const referralRow = z.object({
  code: z.string(),
  invited_count: z.number(),
  points_earned: z.number(),
  has_claimed: z.boolean(),
})

const claimRow = z.object({ points_awarded: z.number() })

function toVoucher(raw: unknown): Voucher {
  const row = parseOrThrow(voucherRow, raw)
  return parseOrThrow(voucherSchema, {
    id: row.id,
    rewardId: row.reward_id,
    title: row.title,
    partner: row.partner,
    category: row.category,
    code: row.code,
    pointsSpent: row.points_spent,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  })
}

/**
 * Everything here goes through the database functions in the rewards migration, so the rules
 * (limits, balance checks, one invite per person) are enforced by Postgres, not by this file.
 */
export function createSupabaseRewardsRepository(ctx: SupabaseContext): RewardsRepository {
  return {
    async getSummary() {
      const raw = await unwrap(ctx, () => ctx.client.rpc('get_rewards_summary'))
      const row = parseOrThrow(summaryRow, raw)
      const entries: PointsEntry[] = row.entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind as PointsEntry['kind'],
        points: entry.points,
        label: entry.label,
        restaurantId: entry.restaurant_id,
        createdAt: entry.created_at,
      }))
      return parseOrThrow(rewardsSummarySchema, {
        balance: row.balance,
        lifetimeEarned: row.lifetime_earned,
        entries,
      })
    },

    async listCatalog() {
      const rows = await unwrap(ctx, () =>
        ctx.client.from('rewards_catalog').select('*').order('cost').order('id'),
      )
      return toList(rows, (raw) => {
        const row = parseOrThrow(catalogRow, raw)
        return parseOrThrow(rewardSchema, row)
      })
    },

    async listVouchers() {
      const rows = await unwrap(ctx, () =>
        ctx.client.from('vouchers').select('*').order('created_at', { ascending: false }),
      )
      return toList(rows, toVoucher)
    },

    async redeem(rewardId) {
      const raw = await unwrap(ctx, () =>
        ctx.client.rpc('redeem_reward', { p_reward_id: rewardId }),
      )
      return toVoucher(raw)
    },

    async markVoucherUsed(voucherId) {
      const raw = await unwrap(ctx, () =>
        ctx.client.rpc('use_voucher', { p_voucher_id: voucherId }),
      )
      return toVoucher(raw)
    },

    async getReferral() {
      const raw = await unwrap(ctx, () => ctx.client.rpc('get_my_referral'))
      const row = parseOrThrow(referralRow, raw)
      return parseOrThrow(referralInfoSchema, {
        code: row.code,
        invitedCount: row.invited_count,
        pointsEarned: row.points_earned,
        hasClaimed: row.has_claimed,
      })
    },

    async claimReferral(rawCode) {
      const code = parseOrThrow(referralCodeSchema, rawCode)
      const raw = await unwrap(ctx, () => ctx.client.rpc('claim_referral', { p_code: code }))
      return { pointsAwarded: parseOrThrow(claimRow, raw).points_awarded }
    },
  }
}
