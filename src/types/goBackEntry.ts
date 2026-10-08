import { z } from 'zod'
import { idSchema, isoDateTimeSchema, text } from './common'

const goBackFields = {
  /** At most one entry per restaurant. */
  restaurantId: idSchema,
  note: text(140).optional(),
}

export const goBackEntryInputSchema = z.object(goBackFields)
export const goBackEntrySchema = z.object({
  id: idSchema,
  ...goBackFields,
  addedAt: isoDateTimeSchema,
})

export type GoBackEntry = z.infer<typeof goBackEntrySchema>
export type GoBackEntryInput = z.infer<typeof goBackEntryInputSchema>
export type GoBackEntryPatch = Partial<GoBackEntryInput>
