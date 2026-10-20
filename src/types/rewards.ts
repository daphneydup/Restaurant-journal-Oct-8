import { z } from 'zod'
import { idSchema, isoDateTimeSchema } from './common'

/** What a points-ledger line is for. `redeem` lines are negative; everything else earns. */
export const POINTS_ENTRY_KINDS = ['visit', 'invite', 'joined', 'redeem'] as const
export const pointsEntryKindSchema = z.enum(POINTS_ENTRY_KINDS)
export type PointsEntryKind = z.infer<typeof pointsEntryKindSchema>

/**
 * One line of the points ledger. Points are never stored as a running total: the balance is the
 * sum of the ledger, so it can't drift out of sync and every change is explainable.
 */
export const pointsEntrySchema = z.object({
  id: idSchema,
  kind: pointsEntryKindSchema,
  /** Positive when earned, negative when spent. Never zero. */
  points: z
    .number()
    .int()
    .refine((n) => n !== 0, 'A ledger line must move some points'),
  /** What the person sees in their history, e.g. "Visit to Cinder House". */
  label: z.string().min(1),
  /** Set for `visit` lines; lets the daily per-restaurant limit work. */
  restaurantId: idSchema.nullable(),
  createdAt: isoDateTimeSchema,
})
export type PointsEntry = z.infer<typeof pointsEntrySchema>

export const REWARD_CATEGORIES = [
  'appetizer',
  'drink',
  'dessert',
  'entree',
  'discount',
  'experience',
] as const
export const rewardCategorySchema = z.enum(REWARD_CATEGORIES)
export type RewardCategory = z.infer<typeof rewardCategorySchema>

/** A perk someone can spend points on. */
export const rewardSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  /** The restaurant (or group) that would honour it. */
  partner: z.string().min(1),
  category: rewardCategorySchema,
  cost: z.number().int().positive(),
})
export type Reward = z.infer<typeof rewardSchema>

export const VOUCHER_STATUSES = ['active', 'used'] as const
export const voucherStatusSchema = z.enum(VOUCHER_STATUSES)
export type VoucherStatus = z.infer<typeof voucherStatusSchema>

/**
 * A redeemed perk. The reward's title and partner are copied onto it, so changing the catalogue
 * later never rewrites what someone already bought. "Expired" is not stored: it is worked out
 * from `expiresAt` (see `voucherState`).
 */
export const voucherSchema = z.object({
  id: idSchema,
  rewardId: idSchema,
  title: z.string().min(1),
  partner: z.string().min(1),
  category: rewardCategorySchema,
  /** Shown to the host or server. */
  code: z.string().min(1),
  pointsSpent: z.number().int().positive(),
  status: voucherStatusSchema,
  createdAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  usedAt: isoDateTimeSchema.nullable(),
})
export type Voucher = z.infer<typeof voucherSchema>

export const rewardsSummarySchema = z.object({
  /** Points available to spend right now. */
  balance: z.number().int(),
  /** Everything ever earned (spending doesn't reduce it). */
  lifetimeEarned: z.number().int(),
  /** Newest first. Supabase returns the most recent 100. */
  entries: z.array(pointsEntrySchema),
})
export type RewardsSummary = z.infer<typeof rewardsSummarySchema>

/** `TFE-` plus six characters, with no 0/O, 1/I/L so a code is easy to read out loud. */
export const REFERRAL_CODE_PATTERN = /^TFE-[A-HJKMNP-Z2-9]{6}$/

/** Trimmed, upper-cased and checked against the code format. */
export const referralCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(REFERRAL_CODE_PATTERN, 'That doesn’t look like an invite code'))

export const referralInfoSchema = z.object({
  /** This person's own invite code. */
  code: referralCodeSchema,
  /** Friends who joined with it. */
  invitedCount: z.number().int().nonnegative(),
  /** Points earned from those friends. */
  pointsEarned: z.number().int().nonnegative(),
  /** True once this person has used someone else's invite (it can only be done once). */
  hasClaimed: z.boolean(),
})
export type ReferralInfo = z.infer<typeof referralInfoSchema>

export interface ReferralClaimResult {
  pointsAwarded: number
}
