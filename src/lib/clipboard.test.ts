import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from './clipboard'

const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true })
}

afterEach(() => {
  if (original) Object.defineProperty(navigator, 'clipboard', original)
  else Reflect.deleteProperty(navigator, 'clipboard')
  vi.restoreAllMocks()
})

describe('copyToClipboard', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    setClipboard({ writeText })
    await expect(copyToClipboard('hello')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to execCommand when the Clipboard API is missing', async () => {
    setClipboard(undefined)
    const exec = vi.fn().mockReturnValue(true)
    document.execCommand = exec
    await expect(copyToClipboard('fallback text')).resolves.toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull() // cleaned up
  })

  it('falls back when the Clipboard API rejects (permission denied)', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) })
    document.execCommand = vi.fn().mockReturnValue(true)
    await expect(copyToClipboard('x')).resolves.toBe(true)
  })

  it('reports failure when nothing works', async () => {
    setClipboard(undefined)
    document.execCommand = vi.fn().mockReturnValue(false)
    await expect(copyToClipboard('x')).resolves.toBe(false)

    document.execCommand = vi.fn(() => {
      throw new Error('blocked')
    })
    await expect(copyToClipboard('x')).resolves.toBe(false)
  })
})
