import type { LogVisitInput, LogVisitResult, Visit, VisitInput, VisitPatch } from '@/types'
import type { Repository } from './Repository'

/**
 * `list()` and `listByRestaurant()` return visits newest first (by date, then created time).
 * `create`/`update` reject with `invalid_reference` if the restaurant or any rated lens is
 * unknown. `remove` also deletes dishes logged on that visit (ON DELETE CASCADE).
 */
export interface VisitRepository extends Repository<Visit, VisitInput, VisitPatch> {
  listByRestaurant(restaurantId: string): Promise<Visit[]>
  /**
   * Saves a whole Log a Visit submission atomically: the restaurant (if new), the visit, its
   * dishes, and the optional go-back entry. Nothing is saved if anything is invalid.
   * Rejects with `conflict` if a "new" restaurant already exists (same name + neighborhood),
   * and with `invalid_reference` for an unknown restaurant or lens.
   */
  logVisit(input: LogVisitInput): Promise<LogVisitResult>
}
