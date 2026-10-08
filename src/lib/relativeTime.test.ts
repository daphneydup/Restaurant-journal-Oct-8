import { describe, expect, it } from 'vitest'
import { durationLabel, formatSince, goBackMessage, daysSince } from './relativeTime'

describe('durationLabel', () => {
  it.each([
    [1, '1 day'],
    [5, '5 days'],
    [7, '1 week'],
    [13, '1 week'],
    [14, '2 weeks'],
    [42, '6 weeks'],
    [59, '8 weeks'],
    [60, '2 months'],
    [100, '3 months'],
    [364, '12 months'],
    [365, 'over a year'],
    [900, 'over a year'],
  ])('%i days -> %s', (days, expected) => {
    expect(durationLabel(days)).toBe(expected)
  })
})

describe('formatSince', () => {
  it.each([
    [0, 'today'],
    [1, 'yesterday'],
    [3, '3 days ago'],
    [21, '3 weeks ago'],
    [200, '6 months ago'],
  ])('%i days -> %s', (days, expected) => {
    expect(formatSince(days)).toBe(expected)
  })
})

describe('daysSince', () => {
  const now = new Date(2026, 9, 8, 12)
  it('counts calendar days from a visit date', () => {
    expect(daysSince('2026-10-08', now)).toBe(0)
    expect(daysSince('2026-09-24', now)).toBe(14)
  })
  it('accepts a full timestamp', () => {
    expect(daysSince('2026-10-01T18:30:00.000Z', now)).toBe(7)
  })
  it('never goes negative for dates in the future', () => {
    expect(daysSince('2026-12-25', now)).toBe(0)
  })
})

describe('goBackMessage', () => {
  it('reassures when the visit was this week', () => {
    expect(goBackMessage({ daysSinceVisit: 3, daysSinceSaved: 30 })).toBe(
      'You were there this week.',
    )
  })

  it('gently counts weeks and months since the last visit', () => {
    expect(goBackMessage({ daysSinceVisit: 42, daysSinceSaved: 50 })).toBe(
      'You haven’t been in 6 weeks.',
    )
    expect(goBackMessage({ daysSinceVisit: 100, daysSinceSaved: 100 })).toBe(
      'You haven’t been in 3 months.',
    )
    expect(goBackMessage({ daysSinceVisit: 7, daysSinceSaved: 7 })).toBe(
      'You haven’t been in 1 week.',
    )
  })

  it('says how long a never-visited spot has been waiting', () => {
    expect(goBackMessage({ daysSinceVisit: null, daysSinceSaved: 14 })).toBe(
      'You haven’t been yet. Saved 2 weeks ago.',
    )
    expect(goBackMessage({ daysSinceVisit: null, daysSinceSaved: 0 })).toBe(
      'You haven’t been yet. Saved just now.',
    )
  })
})
