/** One place for every TanStack Query key, so invalidation can't drift out of sync. */
export const queryKeys = {
  restaurants: {
    all: ['restaurants'] as const,
    list: () => ['restaurants', 'list'] as const,
    detail: (id: string) => ['restaurants', 'detail', id] as const,
  },
  visits: {
    all: ['visits'] as const,
    list: () => ['visits', 'list'] as const,
    byRestaurant: (restaurantId: string) => ['visits', 'byRestaurant', restaurantId] as const,
    detail: (id: string) => ['visits', 'detail', id] as const,
  },
  dishes: {
    all: ['dishes'] as const,
    list: () => ['dishes', 'list'] as const,
    detail: (id: string) => ['dishes', 'detail', id] as const,
    byRestaurant: (restaurantId: string) => ['dishes', 'byRestaurant', restaurantId] as const,
  },
  goBack: {
    all: ['goBack'] as const,
    list: () => ['goBack', 'list'] as const,
    byRestaurant: (restaurantId: string) => ['goBack', 'byRestaurant', restaurantId] as const,
  },
  lenses: {
    all: ['lenses'] as const,
    list: () => ['lenses', 'list'] as const,
  },
  account: {
    all: ['auth'] as const,
    current: () => ['auth', 'user'] as const,
  },
  profile: {
    all: ['profile'] as const,
    current: () => ['profile', 'current'] as const,
  },
}
