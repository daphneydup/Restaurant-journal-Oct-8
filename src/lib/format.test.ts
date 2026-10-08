import { describe, expect, it } from 'vitest'
import { fitWithin } from './image'
import {
  formatPriceTier,
  formatVisitDate,
  joinList,
  PRICE_TIER_LABELS,
  RATING_WORDS,
} from './format'

describe('formatPriceTier', () => {
  it('renders one dollar sign per tier', () => {
    expect([1, 2, 3, 4].map((t) => formatPriceTier(t as 1 | 2 | 3 | 4))).toEqual([
      '$',
      '$$',
      '$$$',
      '$$$$',
    ])
  })

  it('has a label for every tier and rating', () => {
    expect(Object.keys(PRICE_TIER_LABELS)).toHaveLength(4)
    expect(Object.keys(RATING_WORDS)).toHaveLength(5)
  })
})

describe('fitWithin', () => {
  it('scales the longest edge down to the limit, keeping the aspect ratio', () => {
    expect(fitWithin(4000, 3000, 800)).toEqual({ width: 800, height: 600 })
    expect(fitWithin(3000, 4000, 800)).toEqual({ width: 600, height: 800 })
  })

  it('never scales an image up', () => {
    expect(fitWithin(400, 300, 800)).toEqual({ width: 400, height: 300 })
  })
})

describe('joinList', () => {
  it.each([
    [[], ''],
    [['Vegan'], 'Vegan'],
    [['Vegan', 'Steak'], 'Vegan and Steak'],
    [['Vegan', 'Steak', 'Gluten-free'], 'Vegan, Steak and Gluten-free'],
  ])('%j -> %j', (items, expected) => {
    expect(joinList(items)).toBe(expected)
  })
})

describe('formatVisitDate', () => {
  it('formats a visit date for people', () => {
    expect(formatVisitDate('2026-10-05')).toBe('Mon, Oct 5, 2026')
  })
})
