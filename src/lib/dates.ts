const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Formats a Date as a local-calendar `YYYY-MM-DD` string (what a visit's `date` stores). */
export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parses `YYYY-MM-DD` as a local-calendar date (midday, so DST shifts can't change the day). */
export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12)
}

/** A new Date `days` after `date` (negative goes back). Does not mutate. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((b - a) / MS_PER_DAY)
}
