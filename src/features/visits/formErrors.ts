import type { DietLens } from '@/types'
import { FIELD_IDS, ratingFieldId } from './fieldIds'
import type { SummaryError } from './ErrorSummary'

/** Reads `errors.a.b.message` without caring how React Hook Form nested it. */
export function messageAt(errors: unknown, path: readonly (string | number)[]): string | undefined {
  let node: unknown = errors
  for (const key of path) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string | number, unknown>)[key]
  }
  if (typeof node === 'object' && node !== null && 'message' in node) {
    const { message } = node as { message?: unknown }
    return typeof message === 'string' ? message : undefined
  }
  return undefined
}

/**
 * The "things to fix" list, in the order they appear on screen.
 * `ratedLensIds` is the order of `ratings` in the form, since RHF reports rating errors by index.
 */
export function buildErrorSummary(
  errors: unknown,
  { ratedLensIds, lenses }: { ratedLensIds: readonly string[]; lenses: readonly DietLens[] },
): SummaryError[] {
  const items: SummaryError[] = []
  const add = (id: string, message: string | undefined) => {
    if (message) items.push({ id, message })
  }

  add(FIELD_IDS.restaurant, messageAt(errors, ['restaurant', 'restaurantId']))
  add(FIELD_IDS.restaurant, messageAt(errors, ['restaurant', 'name']))
  add(FIELD_IDS.neighborhood, messageAt(errors, ['restaurant', 'neighborhood']))
  add(FIELD_IDS.date, messageAt(errors, ['date']))
  add(FIELD_IDS.lenses, messageAt(errors, ['ratings']) ?? messageAt(errors, ['ratings', 'root']))
  ratedLensIds.forEach((lensId, index) => {
    const message = messageAt(errors, ['ratings', index, 'rating'])
    const label = lenses.find((l) => l.id === lensId)?.shortLabel ?? lensId
    add(ratingFieldId(lensId), message && `${label}: ${message.toLowerCase()}`)
  })
  add(FIELD_IDS.worked, messageAt(errors, ['workedForEveryone']))
  add(FIELD_IDS.photos, messageAt(errors, ['photoUrls']))
  add(FIELD_IDS.note, messageAt(errors, ['note']))
  return items
}
