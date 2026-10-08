import { z } from 'zod'
import {
  dietLensSchema,
  dishSchema,
  goBackEntrySchema,
  restaurantSchema,
  userSchema,
  visitSchema,
} from '@/types'

/** Bump when the persisted shape changes: old localStorage data is discarded and re-seeded. */
export const MOCK_DB_VERSION = 1

export const mockDbSchema = z.object({
  version: z.literal(MOCK_DB_VERSION),
  restaurants: z.array(restaurantSchema),
  visits: z.array(visitSchema),
  dishes: z.array(dishSchema),
  goBackEntries: z.array(goBackEntrySchema),
  lenses: z.array(dietLensSchema),
  user: userSchema,
})

/** The whole in-memory "database" that is persisted to localStorage as one JSON blob. */
export type MockDb = z.infer<typeof mockDbSchema>
