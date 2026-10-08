import type { Visit, VisitInput, VisitPatch } from '@/types'
import type { Repository } from './Repository'

/**
 * `list()` and `listByRestaurant()` return visits newest first (by date, then created time).
 * `create`/`update` reject with `invalid_reference` if the restaurant or any rated lens is
 * unknown. `remove` also deletes dishes logged on that visit (ON DELETE CASCADE).
 */
export interface VisitRepository extends Repository<Visit, VisitInput, VisitPatch> {
  listByRestaurant(restaurantId: string): Promise<Visit[]>
}
