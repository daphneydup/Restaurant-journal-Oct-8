import { RepositoryError } from '../errors'
import type { AuthRepository, RewardsRepository } from '../repositories'
import { parseOrThrow } from '../validation'
import { addDays } from '@/lib/dates'
import {
  POINTS,
  VOUCHER_VALID_DAYS,
  balanceOf,
  lifetimeEarnedOf,
  referralCodeFromId,
  voucherCodeFromId,
} from '@/lib/rewardRules'
import { REWARD_CATALOG } from '@/lib/rewardsCatalog'
import { referralCodeSchema, type PointsEntry, type Voucher } from '@/types'
import { clone } from './helpers'
import type { MockStore } from './store'

const newest = <T extends { createdAt: string }>(a: T, b: T) =>
  b.createdAt.localeCompare(a.createdAt)

/**
 * DEMO ONLY for invites: with no server there is nobody to check a friend's code against, so any
 * well-formed code that isn't your own is accepted and only the joiner is paid. The Supabase
 * implementation verifies the code and pays both sides.
 */
export function createMockRewardsRepository(
  store: MockStore,
  auth: Pick<AuthRepository, 'getCurrentUser'>,
): RewardsRepository {
  /** Reads the rewards state, making this person's invite code the first time it is needed. */
  function ownCode(): string {
    const existing = store.read().rewards.referralCode
    if (existing) return existing
    const code = referralCodeFromId(store.newId())
    store.commit((db) => ({ ...db, rewards: { ...db.rewards, referralCode: code } }))
    return code
  }

  const line = (entry: Omit<PointsEntry, 'id' | 'createdAt'>): PointsEntry => ({
    id: store.newId(),
    createdAt: store.now().toISOString(),
    ...entry,
  })

  return {
    getSummary: () =>
      store.run(() => {
        const { ledger } = store.read().rewards
        return clone({
          balance: balanceOf(ledger),
          lifetimeEarned: lifetimeEarnedOf(ledger),
          entries: [...ledger].sort(newest),
        })
      }),

    listCatalog: () =>
      store.run(() =>
        clone([...REWARD_CATALOG].sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))),
      ),

    listVouchers: () => store.run(() => clone([...store.read().rewards.vouchers].sort(newest))),

    redeem: (rewardId) =>
      store.run(() => {
        const reward = REWARD_CATALOG.find((r) => r.id === rewardId)
        if (!reward) throw new RepositoryError('not_found', `Reward "${rewardId}" was not found.`)
        const { ledger } = store.read().rewards
        if (balanceOf(ledger) < reward.cost) {
          throw new RepositoryError(
            'insufficient_points',
            `You need ${reward.cost - balanceOf(ledger)} more points for this.`,
          )
        }
        const now = store.now()
        const id = store.newId()
        const voucher: Voucher = {
          id,
          rewardId: reward.id,
          title: reward.title,
          partner: reward.partner,
          category: reward.category,
          code: voucherCodeFromId(id),
          pointsSpent: reward.cost,
          status: 'active',
          createdAt: now.toISOString(),
          expiresAt: addDays(now, VOUCHER_VALID_DAYS).toISOString(),
          usedAt: null,
        }
        const spend = line({
          kind: 'redeem',
          points: -reward.cost,
          label: `Redeemed: ${reward.title}`,
          restaurantId: null,
        })
        // One commit: the deduction and the voucher can't be separated.
        store.commit((db) => ({
          ...db,
          rewards: {
            ...db.rewards,
            ledger: [...db.rewards.ledger, spend],
            vouchers: [...db.rewards.vouchers, voucher],
          },
        }))
        return clone(voucher)
      }),

    markVoucherUsed: (voucherId) =>
      store.run(() => {
        const voucher = store.read().rewards.vouchers.find((v) => v.id === voucherId)
        if (!voucher)
          throw new RepositoryError('not_found', `Voucher "${voucherId}" was not found.`)
        if (voucher.status === 'used') {
          throw new RepositoryError('conflict', 'This voucher has already been used.')
        }
        const used: Voucher = { ...voucher, status: 'used', usedAt: store.now().toISOString() }
        store.commit((db) => ({
          ...db,
          rewards: {
            ...db.rewards,
            vouchers: db.rewards.vouchers.map((v) => (v.id === voucherId ? used : v)),
          },
        }))
        return clone(used)
      }),

    getReferral: () =>
      store.run(() => {
        const code = ownCode()
        const { ledger, claimedCode } = store.read().rewards
        const invites = ledger.filter((e) => e.kind === 'invite')
        return clone({
          code,
          invitedCount: invites.length,
          pointsEarned: invites.reduce((sum, e) => sum + e.points, 0),
          hasClaimed: claimedCode !== null,
        })
      }),

    async claimReferral(rawCode) {
      // Checked before the store call so the account state is read at the moment of the claim.
      const user = await auth.getCurrentUser()
      return store.run(() => {
        if (!user || user.isGuest) {
          throw new RepositoryError('not_authenticated', 'Create an account to claim an invite.')
        }
        const code = parseOrThrow(referralCodeSchema, rawCode)
        if (code === ownCode()) {
          throw new RepositoryError('validation', 'You can’t use your own invite code.')
        }
        if (store.read().rewards.claimedCode !== null) {
          throw new RepositoryError('conflict', 'You’ve already used an invite.')
        }
        const bonus = line({
          kind: 'joined',
          points: POINTS.referral,
          label: 'Welcome bonus from a friend’s invite',
          restaurantId: null,
        })
        store.commit((db) => ({
          ...db,
          rewards: {
            ...db.rewards,
            ledger: [...db.rewards.ledger, bonus],
            claimedCode: code,
          },
        }))
        return { pointsAwarded: POINTS.referral }
      })
    },
  }
}
