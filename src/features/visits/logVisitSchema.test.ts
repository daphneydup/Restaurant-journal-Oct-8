import { describe, expect, it } from 'vitest'
import { logVisitInputSchema } from '@/types'
import {
  createDefaultValues,
  createLogVisitFormSchema,
  MAX_NOTE_LENGTH,
  MAX_PHOTOS,
  toLogVisitInput,
  type ValidLogVisitValues,
} from './logVisitSchema'
import { suggestWorkedForEveryone } from './suggestWorkedForEveryone'

const TODAY = '2026-10-08'
const schema = createLogVisitFormSchema(TODAY)

const valid: ValidLogVisitValues = {
  restaurant: { mode: 'existing', restaurantId: 'r-fig' },
  date: TODAY,
  ratings: [
    { lensId: 'vegan', rating: 5 },
    { lensId: 'steak', rating: 4 },
  ],
  workedForEveryone: 'yes',
  priceTier: 2,
  worthIt: undefined,
  companions: [],
  dishes: [],
  photoUrls: [],
  note: '',
  addToGoBack: false,
}

/** Returns "path: message" for every issue, e.g. "ratings.vegan: Tap a rating". */
function issuesFor(values: unknown) {
  const result = schema.safeParse(values)
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

describe('Log a Visit form validation', () => {
  it('accepts the minimum a user actually has to do (spot + one rating per diet)', () => {
    expect(issuesFor(valid)).toEqual([])
  })

  it('accepts a brand-new restaurant', () => {
    const values = {
      ...valid,
      restaurant: { mode: 'new', name: 'Fresh Plate', neighborhood: 'Uptown' },
    }
    expect(issuesFor(values)).toEqual([])
  })

  describe('restaurant', () => {
    it('requires choosing an existing spot', () => {
      const values = { ...valid, restaurant: { mode: 'existing', restaurantId: '' } }
      expect(issuesFor(values)).toEqual([
        'restaurant.restaurantId: Choose a spot, or add a new one',
      ])
    })

    it('requires a name and neighborhood for a new spot', () => {
      const values = { ...valid, restaurant: { mode: 'new', name: '   ', neighborhood: '' } }
      expect(issuesFor(values)).toEqual([
        'restaurant.name: Enter the restaurant’s name',
        'restaurant.neighborhood: Enter the neighborhood',
      ])
    })
  })

  describe('date', () => {
    it('allows today and past dates', () => {
      expect(issuesFor({ ...valid, date: TODAY })).toEqual([])
      expect(issuesFor({ ...valid, date: '2025-01-31' })).toEqual([])
    })

    it('rejects a future date', () => {
      expect(issuesFor({ ...valid, date: '2026-10-09' })).toEqual([
        'date: Visits can’t be in the future',
      ])
    })

    it.each(['', 'yesterday', '2026-02-30', '10/08/2026'])('rejects %j as not a date', (date) => {
      expect(issuesFor({ ...valid, date })).toEqual(['date: Enter a valid date'])
    })
  })

  describe('diets and ratings', () => {
    it('requires at least one diet', () => {
      expect(issuesFor({ ...valid, ratings: [] })).toEqual(['ratings: Pick at least one diet'])
    })

    it('requires a rating for every diet at the table, naming which one is missing', () => {
      const unrated = [
        { lensId: 'vegan', rating: 5 },
        { lensId: 'steak', rating: undefined },
      ]
      expect(issuesFor({ ...valid, ratings: unrated })).toEqual(['ratings.1.rating: Tap a rating'])
      expect(
        issuesFor({
          ...valid,
          ratings: unrated.map((r) => ({ ...r, rating: undefined })),
        }),
      ).toEqual(['ratings.0.rating: Tap a rating', 'ratings.1.rating: Tap a rating'])
    })

    it.each([0, 6, 3.5, '4'])('rejects a rating of %j', (rating) => {
      expect(issuesFor({ ...valid, ratings: [{ lensId: 'vegan', rating }] })).toEqual([
        'ratings.0.rating: Tap a rating',
      ])
    })
  })

  describe('worked for everyone', () => {
    it('is required', () => {
      expect(issuesFor({ ...valid, workedForEveryone: undefined })).toEqual([
        'workedForEveryone: Choose yes, maybe or no',
      ])
    })

    it('only accepts yes, maybe or no', () => {
      expect(issuesFor({ ...valid, workedForEveryone: 'sort of' })).not.toEqual([])
    })
  })

  describe('optional details', () => {
    it('limits notes to 280 characters', () => {
      expect(issuesFor({ ...valid, note: 'x'.repeat(MAX_NOTE_LENGTH) })).toEqual([])
      expect(issuesFor({ ...valid, note: 'x'.repeat(MAX_NOTE_LENGTH + 1) })).toEqual([
        `note: Keep it under ${MAX_NOTE_LENGTH} characters`,
      ])
    })

    it('limits photos', () => {
      const photos = Array.from({ length: MAX_PHOTOS + 1 }, (_, i) => `data:image/jpeg;base64,${i}`)
      expect(issuesFor({ ...valid, photoUrls: photos })).toEqual([
        `photoUrls: Up to ${MAX_PHOTOS} photos`,
      ])
    })

    it('rejects blank dish names and unknown verdicts', () => {
      const dish = { name: 'Gyoza', verdict: 'skip', lensIds: [] }
      expect(issuesFor({ ...valid, dishes: [dish] })).toEqual([])
      expect(issuesFor({ ...valid, dishes: [{ ...dish, name: ' ' }] })).not.toEqual([])
      expect(issuesFor({ ...valid, dishes: [{ ...dish, verdict: 'maybe' }] })).not.toEqual([])
    })

    it('rejects an invalid price tier', () => {
      expect(issuesFor({ ...valid, priceTier: 5 })).not.toEqual([])
    })
  })

  it('reports every problem at once, not one at a time', () => {
    const issues = issuesFor({
      ...valid,
      restaurant: { mode: 'existing', restaurantId: '' },
      date: '2099-01-01',
      ratings: [
        { lensId: 'vegan', rating: undefined },
        { lensId: 'steak', rating: undefined },
      ],
      workedForEveryone: undefined,
    })
    expect(issues).toEqual([
      'restaurant.restaurantId: Choose a spot, or add a new one',
      'date: Visits can’t be in the future',
      'ratings.0.rating: Tap a rating',
      'ratings.1.rating: Tap a rating',
      'workedForEveryone: Choose yes, maybe or no',
    ])
  })
})

describe('createDefaultValues', () => {
  it('starts with today, the profile’s diets, and nothing rated (so one tap per diet finishes the form)', () => {
    const defaults = createDefaultValues({ today: TODAY, lensIds: ['vegan', 'steak'] })
    expect(defaults).toMatchObject({
      date: TODAY,
      ratings: [
        { lensId: 'vegan', rating: undefined },
        { lensId: 'steak', rating: undefined },
      ],
      priceTier: 2,
      note: '',
      addToGoBack: false,
      restaurant: { mode: 'existing', restaurantId: '' },
    })
  })

  it('can preselect a restaurant and its price tier', () => {
    const defaults = createDefaultValues({
      today: TODAY,
      lensIds: [],
      restaurantId: 'r-fig',
      priceTier: 3,
    })
    expect(defaults.restaurant).toEqual({ mode: 'existing', restaurantId: 'r-fig' })
    expect(defaults.priceTier).toBe(3)
  })
})

describe('toLogVisitInput', () => {
  it('maps valid form values into a LogVisitInput the repository accepts', () => {
    const input = toLogVisitInput(valid, { city: 'Dallas' })
    expect(logVisitInputSchema.safeParse(input).success).toBe(true)
    expect(input).toEqual({
      restaurant: { mode: 'existing', restaurantId: 'r-fig' },
      visit: {
        date: TODAY,
        ratings: [
          { lensId: 'vegan', rating: 5 },
          { lensId: 'steak', rating: 4 },
        ],
        workedForEveryone: 'yes',
        priceTier: 2,
        companions: [],
        photoUrls: [],
      },
      dishes: [],
      addToGoBack: false,
    })
  })

  it('uses the home city for a new restaurant and trims its text', () => {
    const input = toLogVisitInput(
      { ...valid, restaurant: { mode: 'new', name: '  Fresh Plate ', neighborhood: ' Uptown ' } },
      { city: 'Austin' },
    )
    expect(input.restaurant).toEqual({
      mode: 'new',
      name: 'Fresh Plate',
      neighborhood: 'Uptown',
      city: 'Austin',
    })
  })

  it('maps worth-it to a boolean and omits empty optional fields', () => {
    const yes = toLogVisitInput({ ...valid, worthIt: 'yes' }, { city: 'Dallas' })
    const no = toLogVisitInput({ ...valid, worthIt: 'no' }, { city: 'Dallas' })
    const unset = toLogVisitInput(valid, { city: 'Dallas' })
    expect(yes.visit.worthIt).toBe(true)
    expect(no.visit.worthIt).toBe(false)
    expect('worthIt' in unset.visit).toBe(false)
    expect('note' in unset.visit).toBe(false)
  })

  it('includes a trimmed note, dishes, companions and the go-back flag', () => {
    const input = toLogVisitInput(
      {
        ...valid,
        note: '  Loved the hummus  ',
        companions: ['Maya'],
        addToGoBack: true,
        dishes: [{ name: 'Gyoza', verdict: 'skip', lensIds: ['vegetarian'] }],
      },
      { city: 'Dallas' },
    )
    expect(input.visit.note).toBe('Loved the hummus')
    expect(input.visit.companions).toEqual(['Maya'])
    expect(input.addToGoBack).toBe(true)
    expect(input.dishes).toEqual([{ name: 'Gyoza', verdict: 'skip', lensIds: ['vegetarian'] }])
  })
})

describe('suggestWorkedForEveryone', () => {
  it('suggests nothing until something is rated', () => {
    expect(suggestWorkedForEveryone([])).toBeUndefined()
  })

  it.each([
    [[5], 'yes'],
    [[5, 4], 'yes'],
    [[4, 4, 4], 'yes'],
    [[5, 3], 'maybe'],
    [[3], 'maybe'],
    [[5, 5, 3], 'maybe'],
    [[5, 2], 'no'],
    [[1], 'no'],
    [[4, 4, 1], 'no'],
  ])('%j -> %s', (ratings, expected) => {
    expect(suggestWorkedForEveryone(ratings)).toBe(expected)
  })
})
