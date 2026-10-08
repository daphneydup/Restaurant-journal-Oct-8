import { z } from 'zod'
import { idSchema } from './common'

export const RATING_VALUES = [1, 2, 3, 4, 5] as const
export const ratingValueSchema = z.literal(RATING_VALUES)
export type RatingValue = z.infer<typeof ratingValueSchema>

/** How well one dietary lens was served on a visit (1 = poor, 5 = great). */
export const dietRatingSchema = z.object({
  lensId: idSchema,
  rating: ratingValueSchema,
})
export type DietRating = z.infer<typeof dietRatingSchema>
