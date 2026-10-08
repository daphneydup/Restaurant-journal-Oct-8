import { describe, expect, it } from 'vitest'
import type { Visit } from '@/types'
import {
  FIT_THRESHOLD,
  formatAverage,
  latestVisitDate,
  lensStats,
  meetsFit,
  workedTally,
  worthItTally,
} from './dietFit'

const visit = (overrides: Partial<Visit> & Pick<Visit, 'id'>): Visit => ({
  restaurantId: 'r1',
  date: '2026-10-01',
  ratings: [{ lensId: 'vegan', rating: 4 }],
  workedForEveryone: 'yes',
  priceTier: 2,
  companions: [],
  photoUrls: [],
  createdAt: '2026-10-01T12:00:00.000Z',
  ...overrides,
})

describe('lensStats', () => {
  it('averages each diet across the visits that rated it', () => {
    const stats = lensStats([
      visit({
        id: 'a',
        ratings: [
          { lensId: 'vegan', rating: 5 },
          { lensId: 'steak', rating: 3 },
        ],
      }),
      visit({ id: 'b', ratings: [{ lensId: 'vegan', rating: 4 }] }),
      visit({
        id: 'c',
        ratings: [
          { lensId: 'vegan', rating: 3 },
          { lensId: 'steak', rating: 4 },
        ],
      }),
    ])
    expect(stats).toEqual([
      { lensId: 'vegan', average: 4, count: 3 },
      { lensId: 'steak', average: 3.5, count: 2 },
    ])
  })

  it('returns nothing without visits', () => {
    expect(lensStats([])).toEqual([])
  })
})

describe('meetsFit', () => {
  it('treats exactly the threshold as working', () => {
    expect(FIT_THRESHOLD).toBe(3.5)
    expect(meetsFit({ average: 3.5 })).toBe(true)
    expect(meetsFit({ average: 3.49 })).toBe(false)
    expect(meetsFit({ average: 5 })).toBe(true)
  })

  it('is not fooled by floating point drift', () => {
    expect(meetsFit({ average: (3.4 + 3.6) / 2 - 0.0000000001 })).toBe(true)
  })
})

describe('formatAverage', () => {
  it.each([
    [4.333, '4.3'],
    [4.35, '4.4'],
    [5, '5'],
    [3.96, '4'],
    [1, '1'],
  ])('%d -> %s', (value, expected) => {
    expect(formatAverage(value)).toBe(expected)
  })
})

describe('workedTally', () => {
  it('counts yes / maybe / no', () => {
    const tally = workedTally([
      visit({ id: 'a', workedForEveryone: 'yes' }),
      visit({ id: 'b', workedForEveryone: 'yes' }),
      visit({ id: 'c', workedForEveryone: 'no' }),
    ])
    expect(tally).toEqual({ yes: 2, maybe: 0, no: 1, total: 3 })
  })
})

describe('worthItTally', () => {
  it('ignores visits where worth-it was not answered', () => {
    const tally = worthItTally([
      visit({ id: 'a', worthIt: true }),
      visit({ id: 'b', worthIt: false }),
      visit({ id: 'c' }),
    ])
    expect(tally).toEqual({ yes: 1, no: 1, answered: 2 })
  })
})

describe('latestVisitDate', () => {
  it('finds the newest date regardless of order', () => {
    expect(
      latestVisitDate([
        visit({ id: 'a', date: '2026-01-01' }),
        visit({ id: 'b', date: '2026-09-09' }),
        visit({ id: 'c', date: '2026-05-05' }),
      ]),
    ).toBe('2026-09-09')
  })
  it('is null without visits', () => {
    expect(latestVisitDate([])).toBeNull()
  })
})
