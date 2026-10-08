import { act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { TEST_NOW } from './testRepositories'

/** Freezes only Date at TEST_NOW so "today" and relative times are stable. Pair with useRealTimers. */
export function freezeToday() {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TEST_NOW)
}

export function newUser() {
  return userEvent.setup()
}

export { act }
