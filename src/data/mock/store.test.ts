import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isRepositoryError } from '../errors'
import { createTestRepositories } from '@/test/testRepositories'
import { MOCK_DB_VERSION } from './db'
import { createMockRepositories, MOCK_STORAGE_KEY } from './index'

const baseOptions = { latencyMs: 0 }

describe('persistence', () => {
  it('seeds on first run and writes the seed to localStorage', async () => {
    const repos = createMockRepositories(baseOptions)
    expect((await repos.restaurants.list()).length).toBeGreaterThanOrEqual(8)
    expect(window.localStorage.getItem(MOCK_STORAGE_KEY)).not.toBeNull()
  })

  it('keeps changes across "reloads" (a second instance on the same storage)', async () => {
    const first = createMockRepositories(baseOptions)
    const created = await first.restaurants.create({
      name: 'Persistent Pie',
      neighborhood: 'Oak Cliff',
      city: 'Dallas',
      priceTier: 2,
    })

    const second = createMockRepositories(baseOptions)
    expect(await second.restaurants.getById(created.id)).toEqual(created)
  })

  it('discards an otherwise valid database saved under an older version', async () => {
    const old = createMockRepositories(baseOptions)
    const mine = await old.restaurants.create({
      name: 'My Old Spot',
      neighborhood: 'Uptown',
      city: 'Dallas',
      priceTier: 2,
    })
    const stored = JSON.parse(window.localStorage.getItem(MOCK_STORAGE_KEY) ?? '{}')
    stored.version = MOCK_DB_VERSION - 1
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(stored))

    const repos = createMockRepositories(baseOptions)
    expect(await repos.restaurants.getById(mine.id)).toBeNull()
    expect((await repos.restaurants.list()).length).toBeGreaterThanOrEqual(8)
  })

  it('re-seeds when stored data is corrupt JSON', async () => {
    window.localStorage.setItem(MOCK_STORAGE_KEY, '{not json')
    const repos = createMockRepositories(baseOptions)
    expect((await repos.restaurants.list()).length).toBeGreaterThanOrEqual(8)
  })

  it('re-seeds when stored data no longer matches the schema', async () => {
    const good = createMockRepositories(baseOptions)
    await good.restaurants.list()
    const stored = JSON.parse(window.localStorage.getItem(MOCK_STORAGE_KEY) ?? '{}')
    stored.restaurants[0].priceTier = 99
    window.localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(stored))

    const repos = createMockRepositories(baseOptions)
    const restaurants = await repos.restaurants.list()
    expect(restaurants.every((r) => r.priceTier >= 1 && r.priceTier <= 4)).toBe(true)
  })

  it('stays in memory only when storage is null', async () => {
    const repos = createMockRepositories({ ...baseOptions, storage: null })
    await repos.restaurants.list()
    expect(window.localStorage.getItem(MOCK_STORAGE_KEY)).toBeNull()
  })

  it('rejects with storage_full and leaves data unchanged when the write fails', async () => {
    const data = new Map<string, string>()
    let failWrites = false
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      removeItem: (key: string) => void data.delete(key),
      setItem: (key: string, value: string) => {
        if (failWrites) throw new DOMException('quota', 'QuotaExceededError')
        data.set(key, value)
      },
    }
    const repos = createMockRepositories({ ...baseOptions, storage })
    const before = await repos.restaurants.list()

    failWrites = true
    const attempt = repos.restaurants.create({
      name: 'Too Big',
      neighborhood: 'Uptown',
      city: 'Dallas',
      priceTier: 1,
    })
    await expect(attempt).rejects.toMatchObject({ code: 'storage_full' })
    expect(await repos.restaurants.list()).toEqual(before)
  })
})

describe('dev controls', () => {
  it('resetDemoData restores the seed and discards user changes', async () => {
    const repos = createMockRepositories(baseOptions)
    const [first] = await repos.restaurants.list()
    await repos.restaurants.remove(first!.id)
    expect(await repos.restaurants.getById(first!.id)).toBeNull()

    await repos.dev?.resetDemoData()
    expect(await repos.restaurants.getById(first!.id)).not.toBeNull()
  })

  it('setSimulateErrors makes every call reject with unavailable until switched off', async () => {
    const repos = createTestRepositories()
    repos.dev?.setSimulateErrors(true)
    expect(repos.dev?.isSimulatingErrors()).toBe(true)

    const error = await repos.restaurants.list().catch((e: unknown) => e)
    expect(isRepositoryError(error) && error.code).toBe('unavailable')

    repos.dev?.setSimulateErrors(false)
    expect((await repos.restaurants.list()).length).toBeGreaterThan(0)
  })

  it('resetDemoData still works while simulating errors, so you can always recover', async () => {
    const repos = createTestRepositories()
    repos.dev?.setSimulateErrors(true)
    await expect(repos.dev?.resetDemoData()).resolves.toBeUndefined()
  })
})

describe('simulated failures', () => {
  it('fails according to failRate using the injected random source', async () => {
    const repos = createTestRepositories({ failRate: 0.5, random: () => 0.2 })
    await expect(repos.restaurants.list()).rejects.toMatchObject({ code: 'unavailable' })

    const lucky = createTestRepositories({ failRate: 0.5, random: () => 0.9 })
    await expect(lucky.restaurants.list()).resolves.toBeDefined()
  })
})

describe('artificial latency', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not resolve until the configured delay has elapsed', async () => {
    const repos = createTestRepositories({ latencyMs: 300 })
    let settled = false
    const pending = repos.restaurants.list().then((result) => {
      settled = true
      return result
    })

    await vi.advanceTimersByTimeAsync(299)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect((await pending).length).toBeGreaterThan(0)
    expect(settled).toBe(true)
  })
})
