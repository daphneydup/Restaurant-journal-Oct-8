import type { AuthRepository } from './AuthRepository'
import type { DietLensRepository } from './DietLensRepository'
import type { DishRepository } from './DishRepository'
import type { GoBackRepository } from './GoBackRepository'
import type { RestaurantRepository } from './RestaurantRepository'
import type { RewardsRepository } from './RewardsRepository'
import type { UserRepository } from './UserRepository'
import type { VisitRepository } from './VisitRepository'

export type { AccountChange, AuthEvent, AuthRepository } from './AuthRepository'
export type { DietLensRepository } from './DietLensRepository'
export type { DishRepository } from './DishRepository'
export type { GoBackRepository } from './GoBackRepository'
export type { Repository } from './Repository'
export type { RestaurantRepository } from './RestaurantRepository'
export type { RewardsRepository } from './RewardsRepository'
export type { UserRepository } from './UserRepository'
export type { VisitRepository } from './VisitRepository'

/** Developer-only controls that exist for the mock layer. Real back ends leave `dev` undefined. */
export interface DevControls {
  /** Re-creates the demo seed data, discarding everything the user logged. */
  resetDemoData(): Promise<void>
  /** While on, every repository call rejects with an `unavailable` error (to see error states). */
  setSimulateErrors(enabled: boolean): void
  isSimulatingErrors(): boolean
}

/** Everything the app needs from "the back end". Provided once via RepositoryProvider. */
export interface Repositories {
  /** Where the data lives, so the UI can say so. */
  kind: 'mock' | 'supabase'
  restaurants: RestaurantRepository
  visits: VisitRepository
  dishes: DishRepository
  goBack: GoBackRepository
  lenses: DietLensRepository
  user: UserRepository
  rewards: RewardsRepository
  auth: AuthRepository
  dev?: DevControls
}
