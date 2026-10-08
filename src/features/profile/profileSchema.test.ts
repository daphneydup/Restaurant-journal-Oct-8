import { describe, expect, it } from 'vitest'
import { profileFormSchema } from './profileSchema'

const valid = { displayName: 'Summer', homeCity: 'Dallas', defaultLensIds: ['vegan', 'steak'] }

function issues(values: unknown) {
  const result = profileFormSchema.safeParse(values)
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
}

describe('profileFormSchema', () => {
  it('accepts a normal profile', () => {
    expect(issues(valid)).toEqual([])
  })

  it('allows no default diets (the user picks each time)', () => {
    expect(issues({ ...valid, defaultLensIds: [] })).toEqual([])
  })

  it('trims whitespace', () => {
    expect(
      profileFormSchema.parse({ ...valid, displayName: '  Sam  ', homeCity: ' Austin ' }),
    ).toMatchObject({
      displayName: 'Sam',
      homeCity: 'Austin',
    })
  })

  it('requires a name and a city', () => {
    expect(issues({ ...valid, displayName: '   ', homeCity: '' })).toEqual([
      'displayName: Enter your name',
      'homeCity: Enter your home city',
    ])
  })

  it('limits lengths', () => {
    expect(issues({ ...valid, displayName: 'x'.repeat(41) })).toEqual([
      'displayName: Keep your name under 40 characters',
    ])
    expect(issues({ ...valid, homeCity: 'x'.repeat(61) })).toEqual([
      'homeCity: Keep the city under 60 characters',
    ])
  })

  it('rejects blank diet ids', () => {
    expect(issues({ ...valid, defaultLensIds: [''] })).not.toEqual([])
  })
})
