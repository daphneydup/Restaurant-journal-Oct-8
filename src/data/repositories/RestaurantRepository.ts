import type { Restaurant, RestaurantInput, RestaurantPatch } from '@/types'
import type { Repository } from './Repository'

/**
 * `list()` returns restaurants A to Z by name.
 * `create`/`update` reject with `conflict` if another restaurant has the same name and
 * neighborhood (case-insensitive). `remove` also deletes the restaurant's visits, dishes and
 * go-back entry (ON DELETE CASCADE in Postgres).
 */
export type RestaurantRepository = Repository<Restaurant, RestaurantInput, RestaurantPatch>
