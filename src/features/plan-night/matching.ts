import { meetsFit, workedTally } from '@/lib/dietFit'
import type { PriceTier } from '@/types'
import type { Spot } from '@/features/restaurants/spots'

export interface PlanInput {
  /** The diets at the table. A spot has to work for ALL of them. */
  lensIds: readonly string[]
  /** The most expensive tier you're willing to pay (inclusive). */
  maxPriceTier: PriceTier
}

export interface LensResult {
  lensId: string
  average: number
  /** Visits that rated this diet. */
  count: number
}

/** A spot that works for everyone, with the numbers that earned its rank. */
export interface Match {
  spot: Spot
  /** One entry per chosen diet, in the order they were chosen. */
  lensResults: LensResult[]
  /** The lowest diet average: a group is only as happy as its least-happy member. */
  weakest: number
  /** Mean of the chosen diets' averages. */
  overall: number
  /** Share of all visits that worked for everyone (0 to 1). */
  workedYesShare: number
}

/** A spot within budget that looks promising but has no rating for some chosen diet yet. */
export interface NeedsData {
  spot: Spot
  rated: LensResult[]
  missingLensIds: string[]
}

export interface PlanResult {
  matches: Match[]
  needsData: NeedsData[]
}

// Compare after rounding, so 4.0000000001 and 4 are the same score.
const score = (n: number) => Math.round(n * 1000) / 1000

/**
 * Ranks the user's own logged spots for a group night out.
 *
 * Qualifies ("matches"): within budget, and every chosen diet has been rated and averages at
 * least the works-for bar. Ranking, best first:
 *   1. weakest chosen diet (higher is better),
 *   2. share of visits that worked for everyone,
 *   3. mean of the chosen diets,
 *   4. most recent visit,
 *   5. name (so the order is always stable).
 *
 * "Needs data": within budget, at least one chosen diet rated and none of the rated ones
 * below the bar, but some chosen diet never rated. Spots we know nothing about are left out.
 */
export function planNight(spots: readonly Spot[], input: PlanInput): PlanResult {
  const { lensIds, maxPriceTier } = input
  if (lensIds.length === 0) return { matches: [], needsData: [] }

  const matches: Match[] = []
  const needsData: NeedsData[] = []

  for (const spot of spots) {
    if (spot.restaurant.priceTier > maxPriceTier) continue

    const rated: LensResult[] = []
    const missingLensIds: string[] = []
    for (const lensId of lensIds) {
      const stat = spot.stats.find((s) => s.lensId === lensId)
      if (stat) rated.push({ lensId, average: stat.average, count: stat.count })
      else missingLensIds.push(lensId)
    }

    if (!rated.every(meetsFit)) continue

    if (missingLensIds.length === 0) {
      const averages = rated.map((r) => r.average)
      const tally = workedTally(spot.visits)
      matches.push({
        spot,
        lensResults: rated,
        weakest: Math.min(...averages),
        overall: averages.reduce((sum, a) => sum + a, 0) / averages.length,
        workedYesShare: tally.total === 0 ? 0 : tally.yes / tally.total,
      })
    } else if (rated.length > 0) {
      needsData.push({ spot, rated, missingLensIds })
    }
  }

  matches.sort(
    (a, b) =>
      score(b.weakest) - score(a.weakest) ||
      score(b.workedYesShare) - score(a.workedYesShare) ||
      score(b.overall) - score(a.overall) ||
      (b.spot.lastVisitDate ?? '').localeCompare(a.spot.lastVisitDate ?? '') ||
      a.spot.restaurant.name.localeCompare(b.spot.restaurant.name),
  )

  needsData.sort(
    (a, b) =>
      score(Math.min(...b.rated.map((r) => r.average))) -
        score(Math.min(...a.rated.map((r) => r.average))) ||
      a.spot.restaurant.name.localeCompare(b.spot.restaurant.name),
  )

  return { matches, needsData }
}
