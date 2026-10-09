import type { Repositories } from '../repositories'
import { createMockAuthRepository } from './authRepository'
import { createMockDietLensRepository } from './lensRepository'
import { createMockDishRepository } from './dishRepository'
import { createMockGoBackRepository } from './goBackRepository'
import { createMockRestaurantRepository } from './restaurantRepository'
import { createMockStore, MOCK_STORAGE_KEY, type MockStoreOptions } from './store'
import { createMockUserRepository } from './userRepository'
import { createMockVisitRepository } from './visitRepository'

export type { MockStoreOptions } from './store'
export { MOCK_STORAGE_KEY } from './store'

/**
 * Builds every repository on one shared in-memory store that persists to localStorage.
 * Only `src/data/index.ts` (and tests) may import this module.
 */
function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function createMockRepositories(options: MockStoreOptions = {}): Repositories {
  const store = createMockStore(options)
  return {
    kind: 'mock',
    restaurants: createMockRestaurantRepository(store),
    visits: createMockVisitRepository(store),
    dishes: createMockDishRepository(store),
    goBack: createMockGoBackRepository(store),
    lenses: createMockDietLensRepository(store),
    user: createMockUserRepository(store),
    auth: createMockAuthRepository({
      store,
      storage: options.storage === undefined ? browserStorage() : options.storage,
      storageKey: `${options.storageKey ?? MOCK_STORAGE_KEY}:auth`,
    }),
    dev: {
      async resetDemoData() {
        // Not subject to simulated failures, so it can always be used to recover.
        await new Promise((resolve) => setTimeout(resolve, 0))
        store.reset()
      },
      setSimulateErrors: (enabled) => store.setSimulateErrors(enabled),
      isSimulatingErrors: () => store.isSimulatingErrors(),
    },
  }
}
