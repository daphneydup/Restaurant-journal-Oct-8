import { z } from 'zod'
import { idSchema, isoDateTimeSchema, text } from './common'

export const DISH_VERDICTS = ['order-again', 'skip'] as const
export const dishVerdictSchema = z.enum(DISH_VERDICTS)
export type DishVerdict = z.infer<typeof dishVerdictSchema>

const dishDetailFields = {
  name: text(60),
  verdict: dishVerdictSchema,
  /** Which dietary lenses this dish works for (may be empty). */
  lensIds: z.array(idSchema),
  photoUrl: z.string().min(1).optional(),
}

const dishFields = {
  restaurantId: idSchema,
  /** The visit where it was logged, if any. Dishes can also be added straight to a restaurant. */
  visitId: idSchema.optional(),
  ...dishDetailFields,
}

/** A dish without its restaurant/visit links, for flows that create those in the same step. */
export const dishDetailsSchema = z.object(dishDetailFields)
export type DishDetails = z.infer<typeof dishDetailsSchema>

export const dishInputSchema = z.object(dishFields)
export const dishSchema = z.object({ id: idSchema, ...dishFields, createdAt: isoDateTimeSchema })

export type Dish = z.infer<typeof dishSchema>
export type DishInput = z.infer<typeof dishInputSchema>
export type DishPatch = Partial<DishInput>
