import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, parseISODate, toISODate } from './dates'

describe('date helpers', () => {
  it('formats local dates as YYYY-MM-DD with zero padding', () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('round-trips through parseISODate', () => {
    expect(toISODate(parseISODate('2026-10-08'))).toBe('2026-10-08')
  })

  it('adds and subtracts days across month boundaries without mutating', () => {
    const start = new Date(2026, 2, 1, 12)
    expect(toISODate(addDays(start, -1))).toBe('2026-02-28')
    expect(toISODate(start)).toBe('2026-03-01')
  })

  it('counts whole calendar days, ignoring time of day', () => {
    expect(daysBetween(new Date(2026, 9, 1, 23, 0), new Date(2026, 9, 8, 1, 0))).toBe(7)
    expect(daysBetween(new Date(2026, 9, 8), new Date(2026, 9, 1))).toBe(-7)
  })

  it('counts days correctly across a daylight-saving change', () => {
    expect(daysBetween(new Date(2026, 2, 7), new Date(2026, 2, 9))).toBe(2)
  })
})
