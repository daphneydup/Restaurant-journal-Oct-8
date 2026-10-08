import { z } from 'zod'
import { idSchema, text } from './common'
import { dishDetailsSchema } from './dish'
import { visitDetailsSchema } from './visit'
import type { Dish } from './dish'
import type { Restaurant } from './restaurant'
import type { Visit } from './visit'

/**
 * Everything the Log a Visit flow saves, as ONE operation. Creating the restaurant, the visit,
 * its dishes and the go-back flag together keeps them consistent: with Supabase this is a
 * single RPC/transaction, so a failure can't leave a restaurant with no visit.
 */
export const logVisitInputSchema = z.object({
  restaurant: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('existing'), restaurantId: idSchema }),
    z.object({
      mode: z.literal('new'),
      name: text(80),
      neighborhood: text(60),
      city: text(60),
      cuisine: text(40).optional(),
    }),
  ]),
  /** A new restaurant takes its price tier from `visit.priceTier`. */
  visit: visitDetailsSchema,
  dishes: z.array(dishDetailsSchema).max(20),
  /** Also flag the restaurant to revisit (no-op if it is already on the list). */
  addToGoBack: z.boolean(),
})

export type LogVisitInput = z.infer<typeof logVisitInputSchema>

export interface LogVisitResult {
  restaurant: Restaurant
  visit: Visit
  dishes: Dish[]
  /** True when the restaurant was created by this call. */
  createdRestaurant: boolean
}
