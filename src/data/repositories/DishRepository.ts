import type { Dish, DishInput, DishPatch } from '@/types'
import type { Repository } from './Repository'

/**
 * `list()` and `listByRestaurant()` return dishes newest first.
 * `create`/`update` reject with `invalid_reference` if the restaurant, visit or any lens is unknown.
 */
export interface DishRepository extends Repository<Dish, DishInput, DishPatch> {
  listByRestaurant(restaurantId: string): Promise<Dish[]>
}
