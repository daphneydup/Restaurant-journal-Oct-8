import { daysBetween, parseISODate } from './dates'

/** "5 days", "1 week", "6 weeks", "3 months", "over a year". Used inside sentences. */
export function durationLabel(days: number): string {
  if (days < 7) return days === 1 ? '1 day' : `${days} days`
  if (days < 60) {
    const weeks = Math.floor(days / 7)
    return weeks === 1 ? '1 week' : `${weeks} weeks`
  }
  if (days < 365) return `${Math.floor(days / 30)} months`
  return 'over a year'
}

/** Whole days between an ISO date (`YYYY-MM-DD` or timestamp) and `now`; never negative. */
export function daysSince(isoDate: string, now: Date): number {
  const from = isoDate.length > 10 ? new Date(isoDate) : parseISODate(isoDate)
  return Math.max(0, daysBetween(from, now))
}

/** Compact "when": today, yesterday, 3 days ago, 2 weeks ago, 4 months ago. */
export function formatSince(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${durationLabel(days)} ago`
}

/**
 * The gentle line on the Go-Back list. Never scolds: a recent visit gets reassurance, a long
 * gap gets a nudge, and a spot you've never tried says how long it has been waiting.
 */
export function goBackMessage({
  daysSinceVisit,
  daysSinceSaved,
}: {
  daysSinceVisit: number | null
  daysSinceSaved: number
}): string {
  if (daysSinceVisit === null) {
    return daysSinceSaved < 1
      ? 'You haven’t been yet. Saved just now.'
      : `You haven’t been yet. Saved ${durationLabel(daysSinceSaved)} ago.`
  }
  if (daysSinceVisit < 7) return 'You were there this week.'
  return `You haven’t been in ${durationLabel(daysSinceVisit)}.`
}
