import type { Visit, WorkedForEveryone } from '@/types'

/** A diet "works" at a spot when its average rating is at least this. Shared by filters and planning. */
export const FIT_THRESHOLD = 3.5

export interface LensStat {
  lensId: string
  /** Mean of every rating given to this diet at the spot. */
  average: number
  /** How many visits rated this diet. */
  count: number
}

/** Average rating per diet across visits. Order follows first appearance. */
export function lensStats(visits: readonly Visit[]): LensStat[] {
  const totals = new Map<string, { sum: number; count: number }>()
  for (const visit of visits) {
    for (const { lensId, rating } of visit.ratings) {
      const entry = totals.get(lensId) ?? { sum: 0, count: 0 }
      entry.sum += rating
      entry.count += 1
      totals.set(lensId, entry)
    }
  }
  return [...totals].map(([lensId, { sum, count }]) => ({ lensId, average: sum / count, count }))
}

export function meetsFit(stat: Pick<LensStat, 'average'>): boolean {
  // Round first so 3.4999999 from float maths still counts as 3.5.
  return Math.round(stat.average * 1000) / 1000 >= FIT_THRESHOLD
}

/** One decimal, dropping a trailing ".0": 4.33 -> "4.3", 5 -> "5". */
export function formatAverage(average: number): string {
  const rounded = Math.round(average * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export type WorkedTally = Record<WorkedForEveryone, number> & { total: number }

export function workedTally(visits: readonly Visit[]): WorkedTally {
  const tally: WorkedTally = { yes: 0, maybe: 0, no: 0, total: visits.length }
  for (const visit of visits) tally[visit.workedForEveryone] += 1
  return tally
}

/** "Worth it?" answers only count visits where the question was answered. */
export function worthItTally(visits: readonly Visit[]): {
  yes: number
  no: number
  answered: number
} {
  let yes = 0
  let no = 0
  for (const { worthIt } of visits) {
    if (worthIt === true) yes += 1
    else if (worthIt === false) no += 1
  }
  return { yes, no, answered: yes + no }
}

/** The most recent visit date (`YYYY-MM-DD`), or null if there are no visits. */
export function latestVisitDate(visits: readonly Visit[]): string | null {
  return visits.reduce<string | null>(
    (latest, v) => (latest === null || v.date > latest ? v.date : latest),
    null,
  )
}
