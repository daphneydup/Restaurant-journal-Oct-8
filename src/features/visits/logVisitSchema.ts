import type { DefaultValues } from 'react-hook-form'
import { z } from 'zod'
import {
  dishVerdictSchema,
  priceTierSchema,
  RATING_VALUES,
  gifUrlSchema,
  text,
  WORKED_FOR_EVERYONE,
  type LogVisitInput,
  type PriceTier,
  type RatingValue,
  type WorkedForEveryone,
} from '@/types'

export const MAX_NOTE_LENGTH = 280
export const MAX_PHOTOS = 3
export const MAX_DISHES = 20
export const DEFAULT_PRICE_TIER: PriceTier = 2

/**
 * The Log a Visit form's rules, with messages written for people ("Tap a rating"), not for
 * developers. `today` is passed in (`YYYY-MM-DD`) so the "not in the future" rule is testable.
 */
export function createLogVisitFormSchema(today: string) {
  return z.object({
    restaurant: z.discriminatedUnion('mode', [
      z.object({
        mode: z.literal('existing'),
        restaurantId: z.string().min(1, 'Choose a spot, or add a new one'),
      }),
      z.object({
        mode: z.literal('new'),
        name: z
          .string()
          .trim()
          .min(1, 'Enter the restaurant’s name')
          .max(80, 'Keep the name under 80 characters'),
        neighborhood: z
          .string()
          .trim()
          .min(1, 'Enter the neighborhood')
          .max(60, 'Keep the neighborhood under 60 characters'),
      }),
    ]),
    // pipe(): the future check only runs once the value is a real date.
    date: z.iso
      .date('Enter a valid date')
      .pipe(z.string().refine((date) => date <= today, 'Visits can’t be in the future')),
    /** One entry per diet at the table; each needs a rating. */
    ratings: z
      .array(
        z.object({
          lensId: z.string().min(1),
          rating: z.literal(RATING_VALUES, { error: 'Tap a rating' }),
        }),
      )
      .min(1, 'Pick at least one diet'),
    workedForEveryone: z.enum(WORKED_FOR_EVERYONE, { error: 'Choose yes, maybe or no' }),
    priceTier: priceTierSchema,
    worthIt: z.enum(['yes', 'no']).optional(),
    companions: z.array(text(40)).max(12, 'That’s plenty of names'),
    dishes: z
      .array(
        z.object({
          name: text(60),
          verdict: dishVerdictSchema,
          lensIds: z.array(z.string().min(1)),
        }),
      )
      .max(MAX_DISHES),
    photoUrls: z.array(z.string().min(1)).max(MAX_PHOTOS, `Up to ${MAX_PHOTOS} photos`),
    note: z.string().trim().max(MAX_NOTE_LENGTH, `Keep it under ${MAX_NOTE_LENGTH} characters`),
    /** A reaction GIF: both are set together, or neither. */
    gifUrl: gifUrlSchema.optional(),
    gifTitle: z.string().trim().min(1).max(200).optional(),
    addToGoBack: z.boolean(),
  })
}

/** What the schema guarantees once validation passes. */
export type ValidLogVisitValues = z.infer<ReturnType<typeof createLogVisitFormSchema>>

/**
 * What the form holds while the user is still filling it in: a diet can be at the table but
 * not rated yet, and "worked for everyone?" starts unanswered.
 */
export type LogVisitFormValues = Omit<ValidLogVisitValues, 'ratings' | 'workedForEveryone'> & {
  ratings: { lensId: string; rating: RatingValue | undefined }[]
  workedForEveryone: WorkedForEveryone | undefined
}

export function createDefaultValues({
  today,
  lensIds,
  restaurantId,
  priceTier = DEFAULT_PRICE_TIER,
}: {
  today: string
  /** Diets pre-selected at the table (usually the profile's defaults). */
  lensIds: string[]
  restaurantId?: string
  priceTier?: PriceTier
}): DefaultValues<LogVisitFormValues> {
  return {
    restaurant: { mode: 'existing', restaurantId: restaurantId ?? '' },
    date: today,
    ratings: lensIds.map((lensId) => ({ lensId, rating: undefined })),
    workedForEveryone: undefined,
    priceTier,
    worthIt: undefined,
    companions: [],
    dishes: [],
    photoUrls: [],
    note: '',
    addToGoBack: false,
  }
}

/** Turns validated form values into the single repository call. */
export function toLogVisitInput(
  values: ValidLogVisitValues,
  { city }: { city: string },
): LogVisitInput {
  const note = values.note.trim()
  return {
    restaurant:
      values.restaurant.mode === 'existing'
        ? { mode: 'existing', restaurantId: values.restaurant.restaurantId }
        : {
            mode: 'new',
            name: values.restaurant.name.trim(),
            neighborhood: values.restaurant.neighborhood.trim(),
            city,
          },
    visit: {
      date: values.date,
      ratings: values.ratings.map(({ lensId, rating }) => ({ lensId, rating })),
      workedForEveryone: values.workedForEveryone,
      priceTier: values.priceTier,
      companions: values.companions,
      photoUrls: values.photoUrls,
      ...(values.worthIt !== undefined && { worthIt: values.worthIt === 'yes' }),
      ...(note !== '' && { note }),
      ...(values.gifUrl && { gifUrl: values.gifUrl, gifTitle: values.gifTitle ?? 'GIF' }),
    },
    dishes: values.dishes.map(({ name, verdict, lensIds }) => ({ name, verdict, lensIds })),
    addToGoBack: values.addToGoBack,
  }
}
