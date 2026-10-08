import { createMockRepositories, type MockStoreOptions } from '@/data/mock'
import type { Repositories } from '@/data/repositories'

/** A fixed "today" so date-relative seed data and timestamps are deterministic in tests. */
export const TEST_NOW = new Date(2026, 9, 8, 12, 0, 0)

/** Zero-latency, in-memory (no localStorage) repositories with predictable ids. */
export function createTestRepositories(overrides: MockStoreOptions = {}): Repositories {
  let counter = 0
  return createMockRepositories({
    latencyMs: 0,
    storage: null,
    now: () => TEST_NOW,
    newId: () => `test-id-${++counter}`,
    ...overrides,
  })
}
