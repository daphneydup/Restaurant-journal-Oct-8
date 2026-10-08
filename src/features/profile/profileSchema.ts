import { z } from 'zod'

/** The Profile form's rules, with messages written for people. */
export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .max(40, 'Keep your name under 40 characters'),
  homeCity: z
    .string()
    .trim()
    .min(1, 'Enter your home city')
    .max(60, 'Keep the city under 60 characters'),
  /** Diets pre-selected when logging a visit or planning a night out. */
  defaultLensIds: z.array(z.string().min(1)),
})

export type ProfileFormValues = z.infer<typeof profileFormSchema>
