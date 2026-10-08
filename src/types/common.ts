import { z } from 'zod'

export const idSchema = z.string().min(1)

/** Calendar date, `YYYY-MM-DD` (no time zone). Used for the day a visit happened. */
export const isoDateSchema = z.iso.date()

/** Instant, ISO 8601 (e.g. `toISOString()` output, or a Postgres `timestamptz`). */
export const isoDateTimeSchema = z.iso.datetime({ offset: true })

/** Trimmed, non-empty text with a max length. */
export const text = (max: number) => z.string().trim().min(1).max(max)
