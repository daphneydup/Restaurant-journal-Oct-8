import { z } from 'zod'
import { idSchema, text } from './common'

const userFields = {
  displayName: text(40),
  /** Lenses pre-selected when logging a visit or planning a night out. */
  defaultLensIds: z.array(idSchema),
  homeCity: text(60),
}

export const userInputSchema = z.object(userFields)
export const userSchema = z.object({ id: idSchema, ...userFields })

export type User = z.infer<typeof userSchema>
export type UserInput = z.infer<typeof userInputSchema>
export type UserPatch = Partial<UserInput>
