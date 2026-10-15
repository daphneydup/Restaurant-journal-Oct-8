import { randomId } from '@/lib/uuid'
import { RepositoryError } from '../errors'
import { mockDbSchema, type MockDb } from './db'
import { buildDemoSeed } from './seed/demo'

export const MOCK_STORAGE_KEY = 'tfe:mock-db'

export interface MockStoreOptions {
  /** Where data persists. Pass `null` to keep everything in memory only. Default: localStorage. */
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
  storageKey?: string
  /** Artificial delay for every call, so loading states are exercised. Default 300ms. */
  latencyMs?: number
  /** Probability (0 to 1) that a call rejects with `unavailable`. Default 0. */
  failRate?: number
  /** Builds the first-run data. Default: the Dallas demo seed. */
  seed?: (now: Date) => MockDb
  now?: () => Date
  random?: () => number
  newId?: () => string
}

export interface MockStore {
  /** The current database. Treat as read-only; change it only through `commit`. */
  read(): MockDb
  /** Applies a pure update, persists it, and only then makes it current. */
  commit(update: (db: MockDb) => MockDb): void
  /** Throws away all data and re-seeds. */
  reset(): void
  /** Deletes everything the user logged (restaurants, visits, dishes, go-back), keeping the diets. */
  wipe(): void
  /** Wraps one repository call with latency and simulated failure, then runs `operation`. */
  run<T>(operation: () => T | Promise<T>): Promise<T>
  setSimulateErrors(enabled: boolean): void
  isSimulatingErrors(): boolean
  newId(): string
  now(): Date
}

function defaultStorage(): MockStoreOptions['storage'] {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null // storage can throw in locked-down browsers
  }
}

export function createMockStore(options: MockStoreOptions = {}): MockStore {
  const {
    storage = defaultStorage(),
    storageKey = MOCK_STORAGE_KEY,
    latencyMs = 300,
    failRate = 0,
    seed = buildDemoSeed,
    now = () => new Date(),
    random = Math.random,
    newId = randomId,
  } = options

  let simulateErrors = false

  function persist(db: MockDb) {
    if (!storage) return
    try {
      storage.setItem(storageKey, JSON.stringify(db))
    } catch (cause) {
      throw new RepositoryError('storage_full', 'Not enough storage space to save this.', { cause })
    }
  }

  function load(): MockDb | null {
    if (!storage) return null
    try {
      const raw = storage.getItem(storageKey)
      if (!raw) return null
      const parsed = mockDbSchema.safeParse(JSON.parse(raw))
      // The schema pins `version`, so data from another version also fails to parse.
      return parsed.success ? parsed.data : null
    } catch {
      return null // unreadable or corrupt: fall back to a fresh seed
    }
  }

  function seeded(): MockDb {
    const db = seed(now())
    try {
      persist(db)
    } catch {
      // Even if the first write fails we can still run from memory.
    }
    return db
  }

  let db: MockDb = load() ?? seeded()

  async function pause() {
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs))
    else await Promise.resolve()
  }

  return {
    read: () => db,
    commit(update) {
      const next = update(db)
      persist(next)
      db = next
    },
    reset() {
      db = seeded()
    },
    wipe() {
      const fresh = seed(now())
      const next: MockDb = {
        ...fresh,
        restaurants: [],
        visits: [],
        dishes: [],
        goBackEntries: [],
      }
      persist(next)
      db = next
    },
    async run(operation) {
      await pause()
      if (simulateErrors || random() < failRate) {
        throw new RepositoryError('unavailable', 'Simulated network failure. Please try again.')
      }
      return operation()
    },
    setSimulateErrors(enabled) {
      simulateErrors = enabled
    },
    isSimulatingErrors: () => simulateErrors,
    newId,
    now,
  }
}
