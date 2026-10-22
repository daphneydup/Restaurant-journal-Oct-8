import type { ReferralClaimResult, ReferralInfo, Reward, RewardsSummary, Voucher } from '@/types'

/**
 * Points, perks and invites. Points live in a ledger that only this repository writes to:
 * visits earn them as they are logged (see `VisitRepository`), and `redeem` / `claimReferral`
 * move them. Nothing in the UI can set a balance.
 */
export interface RewardsRepository {
  /** Balance, lifetime points and the history, newest first. */
  getSummary(): Promise<RewardsSummary>
  /** Every perk on offer, cheapest first. */
  listCatalog(): Promise<Reward[]>
  /** The person's vouchers, newest first. */
  listVouchers(): Promise<Voucher[]>
  /**
   * Spends points on a perk and returns the voucher, atomically: the balance check, the points
   * deduction and the voucher either all happen or none do. Rejects with `not_found` for an
   * unknown perk and `insufficient_points` when the balance is too low.
   */
  redeem(rewardId: string): Promise<Voucher>
  /** Marks a voucher as used. Rejects with `not_found`, or `conflict` if it was already used. */
  markVoucherUsed(voucherId: string): Promise<Voucher>
  /** The person's own invite code and how it has paid off. */
  getReferral(): Promise<ReferralInfo>
  /**
   * Uses a friend's invite code: both people earn the referral bonus. Rules (also enforced by the
   * database): only a signed-in member with a confirmed email can claim (`not_authenticated`),
   * only once (`conflict`), never your own code (`validation`), and the code must exist
   * (`not_found`).
   */
  claimReferral(code: string): Promise<ReferralClaimResult>
}
