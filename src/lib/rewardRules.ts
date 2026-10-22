import type { PointsEntry, Visit, Voucher } from '@/types'

/**
 * The rules of the rewards programme, in one place. The Supabase migration repeats these numbers
 * in SQL (`award_visit_points`, `claim_referral`), so change both together.
 */
export const POINTS = {
  /** For logging a visit with at least one rating (every visit has one). */
  visit: 50,
  /** Bonus for adding a note. */
  note: 10,
  /** Bonus for attaching at least one photo. */
  photo: 10,
  /** Each side of an invite: the friend who joins and the person who invited them. */
  referral: 200,
} as const

export const LIMITS = {
  /** Only this many visits per day earn points, so logging can't be farmed. */
  visitsPerDay: 3,
  /** Only the first visit to a restaurant each day earns points. */
  visitsPerRestaurantPerDay: 1,
  /** After this many friends have joined, further invites no longer pay the inviter. */
  paidInvitesPerPerson: 25,
} as const

/** How long a voucher stays valid after it is redeemed. */
export const VOUCHER_VALID_DAYS = 90

/** The UTC calendar day of a timestamp, the unit the daily limits count in. */
const utcDay = (iso: string) => iso.slice(0, 10)

export interface VisitAward {
  points: number
  label: string
}

/** The points a visit is worth before any daily limit applies. */
export function visitPoints(visit: Pick<Visit, 'note' | 'photoUrls'>): number {
  return (
    POINTS.visit +
    (visit.note?.trim() ? POINTS.note : 0) +
    (visit.photoUrls.length > 0 ? POINTS.photo : 0)
  )
}

/**
 * Decides what a newly logged visit earns, or `null` when a daily limit has been reached.
 * Limits count ledger lines made today (not visits that still exist), so deleting a visit and
 * logging it again doesn't earn twice.
 */
export function awardForVisit(args: {
  visit: Pick<Visit, 'note' | 'photoUrls'>
  restaurantId: string
  restaurantName: string
  ledger: readonly PointsEntry[]
  now: Date
}): VisitAward | null {
  const today = utcDay(args.now.toISOString())
  const earnedToday = args.ledger.filter((e) => e.kind === 'visit' && utcDay(e.createdAt) === today)
  if (earnedToday.length >= LIMITS.visitsPerDay) return null
  const sameSpotToday = earnedToday.filter((e) => e.restaurantId === args.restaurantId)
  if (sameSpotToday.length >= LIMITS.visitsPerRestaurantPerDay) return null
  return { points: visitPoints(args.visit), label: `Visit to ${args.restaurantName}` }
}

export function balanceOf(ledger: readonly PointsEntry[]): number {
  return ledger.reduce((sum, e) => sum + e.points, 0)
}

export function lifetimeEarnedOf(ledger: readonly PointsEntry[]): number {
  return ledger.reduce((sum, e) => (e.points > 0 ? sum + e.points : sum), 0)
}

export type VoucherState = 'active' | 'used' | 'expired'

/** A used voucher stays "used"; an unused one past its date is "expired". */
export function voucherState(
  voucher: Pick<Voucher, 'status' | 'expiresAt'>,
  now: Date,
): VoucherState {
  if (voucher.status === 'used') return 'used'
  return new Date(voucher.expiresAt).getTime() <= now.getTime() ? 'expired' : 'active'
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // no 0, O, 1, I, L

/** Turns any id into a readable code of `length` characters from the unambiguous alphabet. */
export function codeFromId(id: string, length: number): string {
  const chars = id.replace(/[^a-zA-Z0-9]/g, '')
  let out = ''
  for (let i = 0; i < length; i++) {
    const c = chars.charCodeAt(i % Math.max(chars.length, 1)) || i
    out += CODE_ALPHABET[(c + i * 7) % CODE_ALPHABET.length]
  }
  return out
}

export const referralCodeFromId = (id: string) => `TFE-${codeFromId(id, 6)}`
export const voucherCodeFromId = (id: string) =>
  `TFE-${codeFromId(id, 4)}-${codeFromId(id.split('').reverse().join(''), 4)}`

/** Whole points still needed for the cheapest thing the person can't yet afford (null if none). */
export function pointsToNextReward(balance: number, costs: readonly number[]): number | null {
  const next = costs.filter((c) => c > balance).sort((a, b) => a - b)[0]
  return next === undefined ? null : next - balance
}
