import { describe, expect, it } from 'vitest'
import { parsePlanParams, serializePlanParams } from './planParams'

const defaults = ['vegan', 'steak']

describe('plan URL params', () => {
  it('falls back to the profile’s diets and "any budget" with an empty URL', () => {
    expect(parsePlanParams(new URLSearchParams(), defaults)).toEqual({
      lensIds: ['vegan', 'steak'],
      maxPriceTier: 4,
    })
  })

  it('reads diets and budget from the URL', () => {
    expect(
      parsePlanParams(new URLSearchParams('diets=vegetarian,gluten-free&budget=2'), defaults),
    ).toEqual({
      lensIds: ['vegetarian', 'gluten-free'],
      maxPriceTier: 2,
    })
  })

  it('treats an explicit empty diets param as "none chosen", not "use defaults"', () => {
    expect(parsePlanParams(new URLSearchParams('diets='), defaults).lensIds).toEqual([])
  })

  it.each(['0', '5', 'abc', ''])('ignores a bad budget %j', (budget) => {
    expect(parsePlanParams(new URLSearchParams(`budget=${budget}`), defaults).maxPriceTier).toBe(4)
  })

  it('round-trips, omitting the default budget', () => {
    const plan = { lensIds: ['vegan'], maxPriceTier: 3 as const }
    expect(serializePlanParams(plan).toString()).toBe('diets=vegan&budget=3')
    expect(parsePlanParams(serializePlanParams(plan), defaults)).toEqual(plan)
    expect(serializePlanParams({ lensIds: [], maxPriceTier: 4 }).toString()).toBe('diets=')
  })
})
