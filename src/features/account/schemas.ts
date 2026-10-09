import { z } from 'zod'
import { emailSchema, passwordSchema } from '@/types'

/** Form rules for the account screens, with messages written for people. */

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Type your password again'),
  })
  .refine((v) => v.confirmPassword === '' || v.password === v.confirmPassword, {
    message: 'The passwords don’t match',
    path: ['confirmPassword'],
  })
export type SignUpValues = z.infer<typeof signUpSchema>

export const loginSchema = z.object({
  email: emailSchema,
  // Don't apply the new-password rules here: an older account may predate them.
  password: z.string().min(1, 'Enter your password'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const emailOnlySchema = z.object({ email: emailSchema })
export type EmailOnlyValues = z.infer<typeof emailOnlySchema>

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Type your password again'),
  })
  .refine((v) => v.confirmPassword === '' || v.password === v.confirmPassword, {
    message: 'The passwords don’t match',
    path: ['confirmPassword'],
  })
export type NewPasswordValues = z.infer<typeof newPasswordSchema>

/** Deleting an account needs the word typed out, so it can't happen by a slip of the thumb. */
export const DELETE_PHRASE = 'DELETE'
export const deleteConfirmSchema = z.object({
  phrase: z
    .string()
    .refine(
      (v) => v.trim() === DELETE_PHRASE,
      `That doesn’t match. Type ${DELETE_PHRASE} exactly, in capitals.`,
    ),
})
export type DeleteConfirmValues = z.infer<typeof deleteConfirmSchema>
