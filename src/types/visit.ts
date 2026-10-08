import { z } from 'zod'
import { idSchema, isoDateSchema, isoDateTimeSchema, text } from './common'
import { dietRatingSchema } from './dietRating'
import { priceTierSchema } from './priceTier'

export const WORKED_FOR_EVERYONE = ['yes', 'maybe', 'no'] as const
export const workedForEveryoneSchema = z.enum(WORKED_FOR_EVERYONE)
export type WorkedForEveryone = z.infer<typeof workedForEveryoneSchema>

const visitFields = {
  restaurantId: idSchema,
  date: isoDateSchema,
  /**
   * One rating per dietary lens. The lenses present here ARE the diets at the table,
   * so there is no separate "party" field to keep in sync.
   */
  ratings: z.array(dietRatingSchema).min(1, 'Rate at least one diet'),
  workedForEveryone: workedForEveryoneSchema,
  /** The price tier as experienced on this visit. */
  priceTier: priceTierSchema,
  worthIt: z.boolean().optional(),
  note: z.string().trim().max(280).optional(),
  /** Optional first names of who came. */
  companions: z.array(text(40)).max(12),
  /** Photo URLs (data URLs in the mock layer, storage URLs with Supabase). */
  photoUrls: z.array(z.string().min(1)).max(4),
}

const ratingsHaveUniqueLenses = (visit: { ratings: { lensId: string }[] }) =>
  new Set(visit.ratings.map((r) => r.lensId)).size === visit.ratings.length

const uniqueLensesIssue = {
  message: 'Each diet can only be rated once per visit',
  path: ['ratings'],
}

// .omit()/.pick() throw on refined schemas, so both shapes are built from the same fields.
export const visitInputSchema = z
  .object(visitFields)
  .refine(ratingsHaveUniqueLenses, uniqueLensesIssue)
export const visitSchema = z
  .object({ id: idSchema, ...visitFields, createdAt: isoDateTimeSchema })
  .refine(ratingsHaveUniqueLenses, uniqueLensesIssue)

export type Visit = z.infer<typeof visitSchema>
export type VisitInput = z.infer<typeof visitInputSchema>
export type VisitPatch = Partial<VisitInput>
