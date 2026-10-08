import type { GoBackEntry, GoBackEntryInput, GoBackEntryPatch } from '@/types'
import type { Repository } from './Repository'

/**
 * `list()` returns entries newest first. A restaurant has at most one entry: `create` rejects
 * with `conflict` when one exists, and with `invalid_reference` for an unknown restaurant.
 */
export interface GoBackRepository extends Repository<
  GoBackEntry,
  GoBackEntryInput,
  GoBackEntryPatch
> {
  getByRestaurantId(restaurantId: string): Promise<GoBackEntry | null>
}
