import { describe, expect, it } from 'vitest'
import {
  dietLensSchema,
  dietRatingSchema,
  dishInputSchema,
  goBackEntryInputSchema,
  priceTierSchema,
  restaurantInputSchema,
  restaurantSchema,
  userSchema,
  visitInputSchema,
  visitSchema,
  workedForEveryoneSchema,
} from '@/types'

const validVisit = {
  restaurantId: 'r1',
  date: '2026-10-01',
  ratings: [
    { lensId: 'vegan', rating: 5 },
    { lensId: 'steak', rating: 4 },
  ],
  workedForEveryone: 'yes',
  priceTier: 2,
  companions: [],
  photoUrls: [],
}

describe('priceTierSchema', () => {
  it.each([1, 2, 3, 4])('accepts %i', (tier) => {
    expect(priceTierSchema.safeParse(tier).success).toBe(true)
  })

  it.each([0, 5, 2.5, '2', null])('rejects %j', (tier) => {
    expect(priceTierSchema.safeParse(tier).success).toBe(false)
  })
})

describe('dietRatingSchema', () => {
  it.each([1, 2, 3, 4, 5])('accepts a rating of %i', (rating) => {
    expect(dietRatingSchema.safeParse({ lensId: 'vegan', rating }).success).toBe(true)
  })

  it.each([0, 6, -1, 3.5, '4'])('rejects a rating of %j', (rating) => {
    expect(dietRatingSchema.safeParse({ lensId: 'vegan', rating }).success).toBe(false)
  })

  it('requires a lens id', () => {
    expect(dietRatingSchema.safeParse({ lensId: '', rating: 3 }).success).toBe(false)
  })
})

describe('workedForEveryoneSchema', () => {
  it('accepts yes, maybe and no only', () => {
    for (const v of ['yes', 'maybe', 'no'])
      expect(workedForEveryoneSchema.safeParse(v).success).toBe(true)
    expect(workedForEveryoneSchema.safeParse('sometimes').success).toBe(false)
  })
})

describe('dietLensSchema', () => {
  const lens = {
    id: 'vegan',
    label: 'Vegan options',
    shortLabel: 'Vegan',
    icon: 'leaf',
    kind: 'restriction',
    sortOrder: 1,
  }

  it('accepts a valid lens', () => {
    expect(dietLensSchema.safeParse(lens).success).toBe(true)
  })

  it('rejects an unknown kind', () => {
    expect(dietLensSchema.safeParse({ ...lens, kind: 'whim' }).success).toBe(false)
  })
})

describe('restaurantInputSchema', () => {
  const restaurant = {
    name: 'Ember & Orchard',
    neighborhood: 'Uptown',
    city: 'Dallas',
    priceTier: 3,
  }

  it('accepts a valid restaurant and trims text', () => {
    const result = restaurantInputSchema.parse({ ...restaurant, name: '  Ember & Orchard  ' })
    expect(result.name).toBe('Ember & Orchard')
  })

  it('treats cuisine as optional', () => {
    expect(restaurantInputSchema.safeParse(restaurant).success).toBe(true)
    expect(restaurantInputSchema.safeParse({ ...restaurant, cuisine: 'American' }).success).toBe(
      true,
    )
  })

  it.each([
    ['blank name', { name: '   ' }],
    ['missing neighborhood', { neighborhood: '' }],
    ['bad price tier', { priceTier: 9 }],
    ['over-long name', { name: 'x'.repeat(81) }],
  ])('rejects %s', (_label, patch) => {
    expect(restaurantInputSchema.safeParse({ ...restaurant, ...patch }).success).toBe(false)
  })

  it('requires an id and an ISO createdAt on a stored restaurant', () => {
    const stored = { ...restaurant, id: 'r1', createdAt: '2026-10-01T12:00:00.000Z' }
    expect(restaurantSchema.safeParse(stored).success).toBe(true)
    expect(restaurantSchema.safeParse({ ...stored, createdAt: 'yesterday' }).success).toBe(false)
    expect(restaurantSchema.safeParse({ ...stored, id: '' }).success).toBe(false)
  })
})

describe('visitInputSchema', () => {
  it('accepts a valid visit', () => {
    expect(visitInputSchema.safeParse(validVisit).success).toBe(true)
  })

  it('accepts optional worthIt and note', () => {
    expect(
      visitInputSchema.safeParse({ ...validVisit, worthIt: false, note: 'Loud, great fries' })
        .success,
    ).toBe(true)
  })

  it('requires at least one rating', () => {
    const result = visitInputSchema.safeParse({ ...validVisit, ratings: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Rate at least one diet')
  })

  it('rejects rating the same diet twice', () => {
    const result = visitInputSchema.safeParse({
      ...validVisit,
      ratings: [
        { lensId: 'vegan', rating: 5 },
        { lensId: 'vegan', rating: 2 },
      ],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['ratings'])
  })

  it.each([
    ['impossible calendar date', { date: '2026-02-30' }],
    ['wrong date format', { date: '10/01/2026' }],
    ['out-of-range rating', { ratings: [{ lensId: 'vegan', rating: 7 }] }],
    ['unknown worked-for-everyone value', { workedForEveryone: 'kinda' }],
    ['bad price tier', { priceTier: 0 }],
    ['note over 280 characters', { note: 'x'.repeat(281) }],
    ['too many photos', { photoUrls: ['a', 'b', 'c', 'd', 'e'] }],
    ['blank companion name', { companions: [' '] }],
  ])('rejects %s', (_label, patch) => {
    expect(visitInputSchema.safeParse({ ...validVisit, ...patch }).success).toBe(false)
  })

  it('also validates stored visits (id + createdAt)', () => {
    const stored = { ...validVisit, id: 'v1', createdAt: '2026-10-01T12:00:00.000Z' }
    expect(visitSchema.safeParse(stored).success).toBe(true)
    expect(visitSchema.safeParse({ ...stored, id: undefined }).success).toBe(false)
  })
})

describe('dishInputSchema', () => {
  const dish = {
    restaurantId: 'r1',
    name: 'Cauliflower steak',
    verdict: 'order-again',
    lensIds: ['vegan'],
  }

  it('accepts a valid dish with or without a visit', () => {
    expect(dishInputSchema.safeParse(dish).success).toBe(true)
    expect(dishInputSchema.safeParse({ ...dish, visitId: 'v1' }).success).toBe(true)
  })

  it('accepts a dish that suits no particular diet', () => {
    expect(dishInputSchema.safeParse({ ...dish, lensIds: [] }).success).toBe(true)
  })

  it('rejects an unknown verdict and a blank name', () => {
    expect(dishInputSchema.safeParse({ ...dish, verdict: 'maybe' }).success).toBe(false)
    expect(dishInputSchema.safeParse({ ...dish, name: '' }).success).toBe(false)
  })
})

describe('goBackEntryInputSchema', () => {
  it('requires a restaurant and allows an optional note', () => {
    expect(goBackEntryInputSchema.safeParse({ restaurantId: 'r1' }).success).toBe(true)
    expect(
      goBackEntryInputSchema.safeParse({ restaurantId: 'r1', note: 'Try dessert' }).success,
    ).toBe(true)
    expect(goBackEntryInputSchema.safeParse({}).success).toBe(false)
  })
})

describe('userSchema', () => {
  it('accepts a valid user and rejects a blank display name', () => {
    const user = { id: 'u1', displayName: 'Summer', defaultLensIds: ['vegan'], homeCity: 'Dallas' }
    expect(userSchema.safeParse(user).success).toBe(true)
    expect(userSchema.safeParse({ ...user, displayName: ' ' }).success).toBe(false)
  })
})
