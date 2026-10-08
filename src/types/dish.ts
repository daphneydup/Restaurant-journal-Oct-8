import { z } from 'zod'
import { idSchema, isoDateTimeSchema, text } from './common'

export const DISH_VERDICTS = ['order-again', 'skip'] as const
export const dishVerdictSchema = z.enum(DISH_VERDICTS)
export type DishVerdict = z.infer<typeof dishVerdictSchema>

const dishFields = {
  restaurantId: idSchema,
  /** The visit where it was logged, if any. Dishes can also be added straight to a restaurant. */
  visitId: idSchema.optional(),
  name: text(60),
  verdict: dishVerdictSchema,
  /** Which dietary lenses this dish works for (may be empty). */
  lensIds: z.array(idSchema),
  photoUrl: z.string().min(1).optional(),
}

export const dishInputSchema = z.object(dishFields)
export const dishSchema = z.object({ id: idSchema, ...dishFields, createdAt: isoDateTimeSchema })

export type Dish = z.infer<typeof dishSchema>
export type DishInput = z.infer<typeof dishInputSchema>
export type DishPatch = Partial<DishInput>
