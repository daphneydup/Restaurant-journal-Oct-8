import { describe, expect, it } from 'vitest'
import { RepositoryError, type RepositoryErrorCode } from '@/data'
import { describeAuthError } from './authMessages'

const text = (
  code: RepositoryErrorCode,
  action: Parameters<typeof describeAuthError>[1] = 'login',
  message = 'x',
) => describeAuthError(new RepositoryError(code, message), action)

describe('describeAuthError', () => {
  it('words a bad login without revealing which half was wrong', () => {
    expect(text('invalid_credentials')).toBe(
      'That email and password don’t match. Check them and try again.',
    )
  })

  it('tells someone signing up that the email is taken, and points them to log in', () => {
    expect(text('email_taken', 'signup')).toMatch(/already exists.*logging in/)
    expect(text('email_taken', 'email')).toMatch(/Another account already uses that email/)
  })

  it.each([
    ['weak_password', /too easy to guess/],
    ['email_not_confirmed', /confirm your email/i],
    ['rate_limited', /Too many attempts/],
    ['not_authenticated', /log in again/],
  ] as const)('has a clear sentence for %s', (code, pattern) => {
    expect(text(code)).toMatch(pattern)
  })

  it('passes validation messages through (they are written for people)', () => {
    expect(text('validation', 'password', 'Choose a password you haven’t used before.')).toBe(
      'Choose a password you haven’t used before.',
    )
  })

  it.each([
    ['signup', /couldn’t create your account/],
    ['login', /couldn’t log you in/],
    ['reset', /couldn’t send the reset link/],
    ['email', /couldn’t change your email/],
    ['password', /couldn’t change your password/],
    ['delete', /couldn’t delete your account/],
  ] as const)('falls back to a retryable message for a %s failure', (action, pattern) => {
    expect(text('unavailable', action)).toMatch(pattern)
    expect(describeAuthError(new TypeError('boom'), action)).toMatch(/try again/)
  })
})
