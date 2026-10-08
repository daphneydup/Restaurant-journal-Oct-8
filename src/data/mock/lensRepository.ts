import type { DietLensRepository } from '../repositories'
import { clone } from './helpers'
import type { MockStore } from './store'

export function createMockDietLensRepository(store: MockStore): DietLensRepository {
  return {
    list: () =>
      store.run(() => clone([...store.read().lenses].sort((a, b) => a.sortOrder - b.sortOrder))),
    getById: (id) => store.run(() => clone(store.read().lenses.find((l) => l.id === id) ?? null)),
  }
}
