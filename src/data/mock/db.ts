import { z } from 'zod'
import {
  dietLensSchema,
  dishSchema,
  goBackEntrySchema,
  pointsEntrySchema,
  restaurantSchema,
  voucherSchema,
  userSchema,
  visitSchema,
} from '@/types'

/** Bump when the persisted shape changes: old localStorage data is discarded and re-seeded. */
export const MOCK_DB_VERSION = 2

/** Points, vouchers and invite state. `referralCode` is made the first time it is asked for. */
export const mockRewardsSchema = z.object({
  ledger: z.array(pointsEntrySchema),
  vouchers: z.array(voucherSchema),
  referralCode: z.string().nullable(),
  claimedCode: z.string().nullable(),
})
export type MockRewards = z.infer<typeof mockRewardsSchema>

export const mockDbSchema = z.object({
  version: z.literal(MOCK_DB_VERSION),
  restaurants: z.array(restaurantSchema),
  visits: z.array(visitSchema),
  dishes: z.array(dishSchema),
  goBackEntries: z.array(goBackEntrySchema),
  lenses: z.array(dietLensSchema),
  user: userSchema,
  rewards: mockRewardsSchema,
})

/** The whole in-memory "database" that is persisted to localStorage as one JSON blob. */
export type MockDb = z.infer<typeof mockDbSchema>
