import { z } from 'zod'
import { idSchema, isoDateTimeSchema, text } from './common'
import { priceTierSchema } from './priceTier'

const restaurantFields = {
  name: text(80),
  neighborhood: text(60),
  city: text(60),
  priceTier: priceTierSchema,
  cuisine: text(40).optional(),
}

export const restaurantInputSchema = z.object(restaurantFields)
export const restaurantSchema = z.object({
  id: idSchema,
  ...restaurantFields,
  createdAt: isoDateTimeSchema,
})

export type Restaurant = z.infer<typeof restaurantSchema>
export type RestaurantInput = z.infer<typeof restaurantInputSchema>
export type RestaurantPatch = Partial<RestaurantInput>
