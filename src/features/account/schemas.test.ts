import { describe, expect, it } from 'vitest'
import {
  deleteConfirmSchema,
  emailOnlySchema,
  loginSchema,
  newPasswordSchema,
  signUpSchema,
} from './schemas'

function issues(
  schema: {
    safeParse: (v: unknown) => {
      success: boolean
      error?: { issues: { path: PropertyKey[]; message: string }[] }
    }
  },
  value: unknown,
) {
  const result = schema.safeParse(value)
  return result.success
    ? []
    : (result.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`)
}

const signUp = {
  email: 'summer@example.com',
  password: 'correct horse',
  confirmPassword: 'correct horse',
}

describe('signUpSchema', () => {
  it('accepts a good email and matching passwords', () => {
    expect(issues(signUpSchema, signUp)).toEqual([])
  })

  it('accepts an email with stray spaces (keyboards add them)', () => {
    expect(issues(signUpSchema, { ...signUp, email: '  summer@example.com ' })).toEqual([])
  })

  it.each(['', 'summer', 'summer@', '@example.com', 'summer@example', 'a b@example.com'])(
    'rejects the email %j',
    (email) => {
      expect(issues(signUpSchema, { ...signUp, email })).toEqual([
        'email: Enter a valid email address',
      ])
    },
  )

  it('requires at least 8 characters', () => {
    expect(
      issues(signUpSchema, { ...signUp, password: '1234567', confirmPassword: '1234567' }),
    ).toEqual(['password: Use at least 8 characters'])
    expect(
      issues(signUpSchema, { ...signUp, password: '12345678', confirmPassword: '12345678' }),
    ).toEqual([])
  })

  it('caps the password at 72 characters (the limit bcrypt can use)', () => {
    const long = 'x'.repeat(73)
    expect(issues(signUpSchema, { ...signUp, password: long, confirmPassword: long })).toEqual([
      'password: Use 72 characters or fewer',
    ])
  })

  it('requires the confirmation to match, reporting it on the confirm field', () => {
    expect(issues(signUpSchema, { ...signUp, confirmPassword: 'correct horsE' })).toEqual([
      'confirmPassword: The passwords don’t match',
    ])
  })

  it('asks for the confirmation when it is empty', () => {
    expect(issues(signUpSchema, { ...signUp, confirmPassword: '' })).toContain(
      'confirmPassword: Type your password again',
    )
  })

  it('reports every problem at once', () => {
    expect(
      issues(signUpSchema, { email: 'nope', password: 'x', confirmPassword: '' }),
    ).toHaveLength(3)
  })
})

describe('loginSchema', () => {
  it('only needs an email and some password (older accounts may predate the length rule)', () => {
    expect(issues(loginSchema, { email: 'a@example.com', password: 'x' })).toEqual([])
  })

  it('requires both', () => {
    expect(issues(loginSchema, { email: '', password: '' })).toEqual([
      'email: Enter a valid email address',
      'password: Enter your password',
    ])
  })
})

describe('emailOnlySchema', () => {
  it('validates one email', () => {
    expect(issues(emailOnlySchema, { email: 'a@example.com' })).toEqual([])
    expect(issues(emailOnlySchema, { email: 'a@' })).toEqual(['email: Enter a valid email address'])
  })
})

describe('newPasswordSchema', () => {
  it('applies the same rules as sign-up', () => {
    expect(
      issues(newPasswordSchema, { password: 'long enough', confirmPassword: 'long enough' }),
    ).toEqual([])
    expect(issues(newPasswordSchema, { password: 'short', confirmPassword: 'short' })).toEqual([
      'password: Use at least 8 characters',
    ])
    expect(
      issues(newPasswordSchema, { password: 'long enough', confirmPassword: 'different' }),
    ).toEqual(['confirmPassword: The passwords don’t match'])
  })
})

describe('deleteConfirmSchema', () => {
  it('needs the exact word', () => {
    expect(issues(deleteConfirmSchema, { phrase: 'DELETE' })).toEqual([])
    expect(issues(deleteConfirmSchema, { phrase: ' DELETE ' })).toEqual([])
    expect(issues(deleteConfirmSchema, { phrase: 'delete' })).toEqual([
      'phrase: That doesn’t match. Type DELETE exactly, in capitals.',
    ])
    expect(issues(deleteConfirmSchema, { phrase: '' })).toEqual([
      'phrase: That doesn’t match. Type DELETE exactly, in capitals.',
    ])
  })
})
