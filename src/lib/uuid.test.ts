import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomId } from './uuid'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

afterEach(() => vi.unstubAllGlobals())

describe('randomId', () => {
  it('returns a v4 UUID', () => {
    expect(randomId()).toMatch(V4)
  })

  it('still works where crypto.randomUUID is unavailable (plain-HTTP LAN addresses)', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    expect(typeof crypto.randomUUID).toBe('undefined')
    const ids = Array.from({ length: 50 }, randomId)
    for (const id of ids) expect(id).toMatch(V4)
    expect(new Set(ids).size).toBe(50)
  })

  it('sets the version and variant bits whatever the random bytes are', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(0xff) })
    expect(randomId()).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(0x00) })
    expect(randomId()).toBe('00000000-0000-4000-8000-000000000000')
  })
})
