import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthEvent, Repositories } from '../repositories'
import { createMockRepositories, MOCK_STORAGE_KEY } from './index'
import { createTestRepositories } from '@/test/testRepositories'
import type { AuthUser } from '@/types'

let repos: Repositories

beforeEach(() => {
  repos = createTestRepositories()
})

const good = { email: 'summer@example.com', password: 'correct horse' }

describe('demo accounts: the guest to member journey', () => {
  it('starts everyone as a guest', async () => {
    const user = await repos.auth.getCurrentUser()
    expect(user).toMatchObject({ isGuest: true, email: null, pendingEmail: null })
  })

  it('CREATE: signing up upgrades the guest in place, keeping the same id', async () => {
    const guest = (await repos.auth.getCurrentUser())!
    const { user, needsEmailConfirmation } = await repos.auth.signUp({
      email: ' Summer@Example.com ',
      password: good.password,
    })

    expect(user).toMatchObject({ id: guest.id, email: 'summer@example.com', isGuest: false })
    expect(needsEmailConfirmation).toBe(false)
    expect(await repos.auth.getCurrentUser()).toEqual(user)
  })

  it('keeps the journal when a guest signs up', async () => {
    const before = (await repos.restaurants.list()).length
    await repos.auth.signUp(good)
    expect(await repos.restaurants.list()).toHaveLength(before)
  })

  it.each([
    ['a malformed email', { email: 'not-an-email', password: good.password }],
    ['a password under 8 characters', { email: good.email, password: 'short' }],
    ['an empty email', { email: '', password: good.password }],
  ])('rejects %s with a validation error', async (_label, credentials) => {
    await expect(repos.auth.signUp(credentials)).rejects.toMatchObject({ code: 'validation' })
  })

  it('refuses an email that already has an account (any capitalisation)', async () => {
    await repos.auth.signUp(good)
    await repos.auth.signOut()
    await expect(
      repos.auth.signUp({ email: 'SUMMER@example.com', password: 'another password' }),
    ).rejects.toMatchObject({
      code: 'email_taken',
    })
  })

  it('refuses to sign up again while already a member', async () => {
    await repos.auth.signUp(good)
    await expect(
      repos.auth.signUp({ email: 'b@example.com', password: 'another password' }),
    ).rejects.toMatchObject({
      code: 'validation',
    })
  })
})

describe('demo accounts: signing in and out', () => {
  beforeEach(async () => {
    await repos.auth.signUp(good)
    await repos.auth.signOut()
  })

  it('signing out leaves nobody signed in', async () => {
    expect(await repos.auth.getCurrentUser()).toBeNull()
  })

  it('signs in with the right email and password, ignoring email case and spaces', async () => {
    const user = await repos.auth.signIn({
      email: '  SUMMER@example.com ',
      password: good.password,
    })
    expect(user).toMatchObject({ email: 'summer@example.com', isGuest: false })
    expect(await repos.auth.getCurrentUser()).toEqual(user)
  })

  it('gives the same answer for a wrong password and an unknown email (no account probing)', async () => {
    const wrongPassword = await repos.auth
      .signIn({ email: good.email, password: 'wrong password' })
      .catch((e: unknown) => e)
    const unknownEmail = await repos.auth
      .signIn({ email: 'nobody@example.com', password: good.password })
      .catch((e: unknown) => e)
    expect(wrongPassword).toMatchObject({ code: 'invalid_credentials' })
    expect(unknownEmail).toMatchObject({ code: 'invalid_credentials' })
    expect((wrongPassword as Error).message).toBe((unknownEmail as Error).message)
  })

  it('a failed sign-in does not sign anyone in', async () => {
    await repos.auth
      .signIn({ email: good.email, password: 'wrong password' })
      .catch(() => undefined)
    expect(await repos.auth.getCurrentUser()).toBeNull()
  })

  it('a new guest session starts again after signing out and signing up fresh', async () => {
    const { user } = await repos.auth.signUp({
      email: 'second@example.com',
      password: 'second password',
    })
    expect(user.isGuest).toBe(false)
  })
})

describe('demo accounts: updating', () => {
  it('UPDATE email: members can change it, and log in with the new one', async () => {
    await repos.auth.signUp(good)
    const { user } = await repos.auth.updateEmail('New@Example.com')
    expect(user.email).toBe('new@example.com')

    await repos.auth.signOut()
    await expect(
      repos.auth.signIn({ email: good.email, password: good.password }),
    ).rejects.toMatchObject({ code: 'invalid_credentials' })
    await expect(
      repos.auth.signIn({ email: 'new@example.com', password: good.password }),
    ).resolves.toBeDefined()
  })

  it('UPDATE email: rejects an address someone else has, and a malformed one', async () => {
    await repos.auth.signUp(good)
    await repos.auth.signOut()
    await repos.auth.signUp({ email: 'other@example.com', password: 'other password' })
    await expect(repos.auth.updateEmail(good.email)).rejects.toMatchObject({ code: 'email_taken' })
    await expect(repos.auth.updateEmail('nope')).rejects.toMatchObject({ code: 'validation' })
    // Keeping your own address is fine.
    await expect(repos.auth.updateEmail('OTHER@example.com')).resolves.toBeDefined()
  })

  it('UPDATE password: the new one works and the old one stops working', async () => {
    await repos.auth.signUp(good)
    await repos.auth.updatePassword('a brand new password')
    await repos.auth.signOut()

    await expect(repos.auth.signIn(good)).rejects.toMatchObject({ code: 'invalid_credentials' })
    await expect(
      repos.auth.signIn({ email: good.email, password: 'a brand new password' }),
    ).resolves.toBeDefined()
  })

  it('UPDATE password: rejects a weak one', async () => {
    await repos.auth.signUp(good)
    await expect(repos.auth.updatePassword('short')).rejects.toMatchObject({ code: 'validation' })
  })

  it('guests cannot change email or password (they create an account instead)', async () => {
    await expect(repos.auth.updateEmail('a@example.com')).rejects.toMatchObject({
      code: 'not_authenticated',
    })
    await expect(repos.auth.updatePassword('long enough password')).rejects.toMatchObject({
      code: 'not_authenticated',
    })
  })

  it('signed-out visitors cannot either', async () => {
    await repos.auth.signOut()
    await expect(repos.auth.updatePassword('long enough password')).rejects.toMatchObject({
      code: 'not_authenticated',
    })
  })
})

describe('demo accounts: password reset', () => {
  it('resolves the same for known and unknown addresses', async () => {
    await repos.auth.signUp(good)
    await expect(repos.auth.requestPasswordReset(good.email)).resolves.toBeUndefined()
    await expect(repos.auth.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined()
  })

  it('rejects something that is not an email', async () => {
    await expect(repos.auth.requestPasswordReset('nope')).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('is never in recovery mode (no email link exists in demo mode)', () => {
    expect(repos.auth.isRecovering()).toBe(false)
  })
})

describe('demo accounts: DELETE', () => {
  it('removes the account and all of its journal, keeps the diets, and signs out', async () => {
    await repos.auth.signUp(good)
    expect((await repos.restaurants.list()).length).toBeGreaterThan(0)

    await repos.auth.deleteAccount()

    expect(await repos.auth.getCurrentUser()).toBeNull()
    expect(await repos.restaurants.list()).toEqual([])
    expect(await repos.visits.list()).toEqual([])
    expect(await repos.goBack.list()).toEqual([])
    expect((await repos.lenses.list()).length).toBeGreaterThan(0)
    await expect(repos.auth.signIn(good)).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('a guest can delete their data too', async () => {
    await repos.auth.deleteAccount()
    expect(await repos.restaurants.list()).toEqual([])
    expect(await repos.auth.getCurrentUser()).toBeNull()
  })

  it('the email can be used for a new account afterwards', async () => {
    await repos.auth.signUp(good)
    await repos.auth.deleteAccount()
    await expect(repos.auth.signUp(good)).resolves.toBeDefined()
  })
})

describe('demo accounts: change notifications', () => {
  it('tells listeners about each change, and stops after unsubscribe', async () => {
    const seen: [AuthEvent, AuthUser | null][] = []
    const stop = repos.auth.onChange((event, user) => seen.push([event, user]))

    await repos.auth.signUp(good)
    await repos.auth.signOut()
    await repos.auth.signIn(good)
    stop()
    await repos.auth.signOut()

    expect(seen.map(([event]) => event)).toEqual(['updated', 'signed_out', 'signed_in'])
    expect(seen[0]![1]).toMatchObject({ isGuest: false })
    expect(seen[1]![1]).toBeNull()
    expect(seen[2]![1]).toMatchObject({ email: good.email })
  })
})

describe('demo accounts: storage', () => {
  it('persists across reloads (a second instance on the same storage)', async () => {
    const first = createMockRepositories({ latencyMs: 0 })
    await first.auth.signUp(good)

    const second = createMockRepositories({ latencyMs: 0 })
    expect(await second.auth.getCurrentUser()).toMatchObject({ email: good.email, isGuest: false })
    await second.auth.signOut()
    await expect(second.auth.signIn(good)).resolves.toBeDefined()
  })

  it('never writes the password to storage', async () => {
    const repo = createMockRepositories({ latencyMs: 0 })
    await repo.auth.signUp(good)
    const raw = window.localStorage.getItem(`${MOCK_STORAGE_KEY}:auth`) ?? ''
    expect(raw).toContain(good.email)
    expect(raw).not.toContain(good.password)
  })

  it('survives corrupt storage by starting fresh as a guest', async () => {
    window.localStorage.setItem(`${MOCK_STORAGE_KEY}:auth`, '{broken')
    const repo = createMockRepositories({ latencyMs: 0 })
    expect(await repo.auth.getCurrentUser()).toMatchObject({ isGuest: true })
  })

  it('honours simulated outages like every other repository', async () => {
    repos.dev?.setSimulateErrors(true)
    await expect(repos.auth.getCurrentUser()).rejects.toMatchObject({ code: 'unavailable' })
    await expect(repos.auth.signIn(good)).rejects.toMatchObject({ code: 'unavailable' })
  })
})

describe('demo accounts: timing', () => {
  it('applies the artificial latency', async () => {
    vi.useFakeTimers()
    const slow = createTestRepositories({ latencyMs: 300 })
    let done = false
    void slow.auth.getCurrentUser().then(() => (done = true))
    await vi.advanceTimersByTimeAsync(299)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toBe(true)
    vi.useRealTimers()
  })
})
