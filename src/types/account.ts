import { z } from 'zod'
import { idSchema, isoDateTimeSchema } from './common'

/** The password rules, in one place so the form and every data layer agree. */
export const MIN_PASSWORD_LENGTH = 8

// Trim BEFORE checking the format: keyboards often autocomplete a trailing space.
export const emailSchema = z.string().trim().pipe(z.email('Enter a valid email address'))

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(72, 'Use 72 characters or fewer')

export const credentialsSchema = z.object({
  email: emailSchema.transform((value) => value.toLowerCase()),
  password: passwordSchema,
})
export type Credentials = z.input<typeof credentialsSchema>

/**
 * Who is signed in. A "guest" is an anonymous session: it can use the whole app, but its data is
 * only reachable from this browser until the guest creates an account.
 */
export const authUserSchema = z.object({
  id: idSchema,
  email: z.string().nullable(),
  /** A new address waiting for the user to confirm it by email, if any. */
  pendingEmail: z.string().nullable(),
  isGuest: z.boolean(),
  createdAt: isoDateTimeSchema,
})
export type AuthUser = z.infer<typeof authUserSchema>
