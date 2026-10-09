import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authUserBody,
  createFakeSupabase,
  memberBody,
  sessionBody,
  type FakeSupabase,
} from '@/test/fakeSupabase'
import type { AuthEvent, Repositories } from '../repositories'

let fake: FakeSupabase
let repos: Repositories

beforeEach(() => {
  fake = createFakeSupabase()
  repos = fake.repositories()
})

const authCalls = (path: RegExp, method?: string) =>
  fake.calls.filter((c) => path.test(c.path) && (!method || c.method === method))

/** Signs in as an existing member so the next calls run as that member. */
async function asMember(email = 'summer@example.com') {
  fake.on('POST', /\/auth\/v1\/token$/, { body: sessionBody(memberBody(email)) })
  await repos.auth.signIn({ email, password: 'correct horse' })
}

describe('READ: the current user', () => {
  it('is null until a session exists', async () => {
    expect(await repos.auth.getCurrentUser()).toBeNull()
    expect(fake.signIns()).toHaveLength(0) // reading must not create a guest
  })

  it('is a guest once the app has started its anonymous session', async () => {
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [] })
    await repos.restaurants.list() // the first data request starts the guest session
    expect(await repos.auth.getCurrentUser()).toEqual({
      id: 'user-1',
      email: null,
      pendingEmail: null,
      isGuest: true,
      createdAt: '2026-10-08T12:00:00.123456Z',
    })
  })
})

describe('CREATE: sign up (a guest becomes a member, same user)', () => {
  it('gives the guest an email and password, keeping the same user id', async () => {
    fake.on('PUT', /\/auth\/v1\/user$/, { body: memberBody('summer@example.com') })

    const { user, needsEmailConfirmation } = await repos.auth.signUp({
      email: ' Summer@Example.com ',
      password: 'correct horse',
    })

    const [put] = authCalls(/\/auth\/v1\/user$/, 'PUT')
    expect(put!.body).toMatchObject({ email: 'summer@example.com', password: 'correct horse' })
    expect(put!.headers.get('authorization')).toMatch(/^Bearer /) // sent as the guest
    expect(user).toMatchObject({ id: 'user-1', email: 'summer@example.com', isGuest: false })
    expect(needsEmailConfirmation).toBe(false)
    expect(fake.signIns()).toHaveLength(1) // it upgraded the guest; it did not make a second user
  })

  it('says a confirmation email is needed when Supabase is waiting for the link', async () => {
    fake.on('PUT', /\/auth\/v1\/user$/, {
      body: authUserBody({ new_email: 'summer@example.com', email: '' }),
    })
    const result = await repos.auth.signUp({
      email: 'summer@example.com',
      password: 'correct horse',
    })
    expect(result.needsEmailConfirmation).toBe(true)
    expect(result.user).toMatchObject({ isGuest: true, pendingEmail: 'summer@example.com' })
  })

  it('validates before sending anything', async () => {
    await expect(
      repos.auth.signUp({ email: 'nope', password: 'correct horse' }),
    ).rejects.toMatchObject({ code: 'validation' })
    await expect(
      repos.auth.signUp({ email: 'a@example.com', password: 'short' }),
    ).rejects.toMatchObject({ code: 'validation' })
    expect(fake.calls).toHaveLength(0)
  })

  it('reports an email that already has an account', async () => {
    fake.on('PUT', /\/auth\/v1\/user$/, {
      status: 422,
      body: {
        code: 'email_exists',
        error_code: 'email_exists',
        msg: 'A user with this email address has already been registered',
      },
    })
    await expect(
      repos.auth.signUp({ email: 'taken@example.com', password: 'correct horse' }),
    ).rejects.toMatchObject({ code: 'email_taken' })
  })

  it('reports a password the project rejects as weak', async () => {
    fake.on('PUT', /\/auth\/v1\/user$/, {
      status: 422,
      body: {
        code: 'weak_password',
        error_code: 'weak_password',
        msg: 'Password is too weak',
        weak_password: { reasons: ['pwned'] },
      },
    })
    await expect(
      repos.auth.signUp({ email: 'a@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ code: 'weak_password' })
  })

  it('refuses when already a member, without calling the server again', async () => {
    await asMember()
    await expect(
      repos.auth.signUp({ email: 'b@example.com', password: 'another password' }),
    ).rejects.toMatchObject({ code: 'validation' })
    expect(authCalls(/\/auth\/v1\/user$/, 'PUT')).toHaveLength(0)
  })
})

describe('sign in and out', () => {
  it('signs in with email and password (trimmed and lower-cased)', async () => {
    fake.on('POST', /\/auth\/v1\/token$/, { body: sessionBody(memberBody()) })
    const user = await repos.auth.signIn({
      email: '  Summer@Example.com',
      password: 'correct horse',
    })

    const [call] = authCalls(/\/auth\/v1\/token$/)
    expect(call!.search.get('grant_type')).toBe('password')
    expect(call!.body).toMatchObject({ email: 'summer@example.com', password: 'correct horse' })
    expect(user).toMatchObject({ email: 'summer@example.com', isGuest: false })
  })

  it('reports wrong credentials', async () => {
    fake.on('POST', /\/auth\/v1\/token$/, {
      status: 400,
      body: {
        code: 'invalid_credentials',
        error_code: 'invalid_credentials',
        msg: 'Invalid login credentials',
      },
    })
    await expect(
      repos.auth.signIn({ email: 'a@example.com', password: 'wrong password' }),
    ).rejects.toMatchObject({
      code: 'invalid_credentials',
      message: 'That email and password don’t match.',
    })
  })

  it('reports an unconfirmed email and a rate limit distinctly', async () => {
    fake.on('POST', /\/auth\/v1\/token$/, {
      status: 400,
      body: { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' },
    })
    await expect(
      repos.auth.signIn({ email: 'a@example.com', password: 'correct horse' }),
    ).rejects.toMatchObject({ code: 'email_not_confirmed' })

    fake.on('POST', /\/auth\/v1\/token$/, {
      status: 429,
      body: { code: 429, error_code: 'over_request_rate_limit', msg: 'Too many requests' },
    })
    await expect(
      repos.auth.signIn({ email: 'a@example.com', password: 'correct horse' }),
    ).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('treats a server fault as unavailable (retryable), not as bad credentials', async () => {
    fake.on('POST', /\/auth\/v1\/token$/, { status: 500, body: { msg: 'boom' } })
    await expect(
      repos.auth.signIn({ email: 'a@example.com', password: 'correct horse' }),
    ).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('signing out clears the session, and the next data request starts a fresh guest', async () => {
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [] })
    await asMember()
    await repos.restaurants.list()
    expect(fake.signIns()).toHaveLength(0) // used the member session, no guest created

    await repos.auth.signOut()
    expect(await repos.auth.getCurrentUser()).toBeNull()
    expect(authCalls(/\/auth\/v1\/logout$/)).toHaveLength(1)

    await repos.restaurants.list()
    expect(fake.signIns()).toHaveLength(1) // a brand-new guest, not a stale member id
  })
})

describe('UPDATE: email and password (members only)', () => {
  it('guests are told to create an account first, with no request sent', async () => {
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [] })
    await repos.restaurants.list() // become a guest
    const before = fake.calls.length
    await expect(repos.auth.updateEmail('a@example.com')).rejects.toMatchObject({
      code: 'not_authenticated',
    })
    await expect(repos.auth.updatePassword('long enough password')).rejects.toMatchObject({
      code: 'not_authenticated',
    })
    expect(fake.calls).toHaveLength(before)
  })

  it('changes the email and says when the new address must be confirmed first', async () => {
    await asMember()
    fake.on('PUT', /\/auth\/v1\/user$/, {
      body: memberBody('summer@example.com', { new_email: 'new@example.com' }),
    })

    const change = await repos.auth.updateEmail(' NEW@example.com ')
    expect(authCalls(/\/auth\/v1\/user$/, 'PUT')[0]!.body).toMatchObject({
      email: 'new@example.com',
    })
    expect(change.needsEmailConfirmation).toBe(true)
    expect(change.user.pendingEmail).toBe('new@example.com')
    expect(change.user.email).toBe('summer@example.com') // unchanged until they confirm
  })

  it('changes the password', async () => {
    await asMember()
    fake.on('PUT', /\/auth\/v1\/user$/, { body: memberBody() })
    await expect(repos.auth.updatePassword('a brand new password')).resolves.toBeUndefined()
    expect(authCalls(/\/auth\/v1\/user$/, 'PUT')[0]!.body).toMatchObject({
      password: 'a brand new password',
    })
  })

  it('validates the new password before sending', async () => {
    await asMember()
    await expect(repos.auth.updatePassword('short')).rejects.toMatchObject({ code: 'validation' })
    expect(authCalls(/\/auth\/v1\/user$/, 'PUT')).toHaveLength(0)
  })

  it('reports reusing the same password as a validation problem', async () => {
    await asMember()
    fake.on('PUT', /\/auth\/v1\/user$/, {
      status: 422,
      body: { code: 422, error_code: 'same_password', msg: 'New password should be different' },
    })
    await expect(repos.auth.updatePassword('correct horse')).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('reports an address already in use', async () => {
    await asMember()
    fake.on('PUT', /\/auth\/v1\/user$/, {
      status: 422,
      body: { code: 422, error_code: 'email_exists', msg: 'already registered' },
    })
    await expect(repos.auth.updateEmail('taken@example.com')).rejects.toMatchObject({
      code: 'email_taken',
    })
  })
})

describe('password reset', () => {
  it('asks Supabase to email a link that returns to /reset-password', async () => {
    fake.on('POST', /\/auth\/v1\/recover$/, { body: {} })
    await repos.auth.requestPasswordReset(' Summer@Example.com ')

    const [call] = authCalls(/\/auth\/v1\/recover$/)
    expect(call!.body).toMatchObject({ email: 'summer@example.com' })
    expect(call!.search.get('redirect_to')).toBe(`${window.location.origin}/reset-password`)
  })

  it('validates the address and reports a rate limit', async () => {
    await expect(repos.auth.requestPasswordReset('nope')).rejects.toMatchObject({
      code: 'validation',
    })
    fake.on('POST', /\/auth\/v1\/recover$/, {
      status: 429,
      body: { code: 429, error_code: 'over_email_send_rate_limit', msg: 'rate limit' },
    })
    await expect(repos.auth.requestPasswordReset('a@example.com')).rejects.toMatchObject({
      code: 'rate_limited',
    })
  })

  it('is not in recovery mode unless the user arrived from a reset link', () => {
    expect(repos.auth.isRecovering()).toBe(false)
  })
})

describe('DELETE: the account and everything in it', () => {
  it('calls the database function, then clears the local session', async () => {
    await asMember()
    fake.on('POST', /\/rest\/v1\/rpc\/delete_my_account$/, { status: 204 })

    await repos.auth.deleteAccount()

    expect(fake.dataCalls().some((c) => c.path.endsWith('/rpc/delete_my_account'))).toBe(true)
    expect(authCalls(/\/auth\/v1\/logout$/)).toHaveLength(1)
    expect(await repos.auth.getCurrentUser()).toBeNull()
  })

  it('does not sign out locally if the deletion failed', async () => {
    await asMember()
    fake.on('POST', /\/rest\/v1\/rpc\/delete_my_account$/, {
      status: 500,
      body: { message: 'boom' },
    })

    await expect(repos.auth.deleteAccount()).rejects.toMatchObject({ code: 'unavailable' })
    expect(await repos.auth.getCurrentUser()).toMatchObject({ isGuest: false })
  })

  it('works for a guest too (they delete their own data)', async () => {
    fake.on('POST', /\/rest\/v1\/rpc\/delete_my_account$/, { status: 204 })
    await expect(repos.auth.deleteAccount()).resolves.toBeUndefined()
    expect(fake.signIns()).toHaveLength(1) // a guest session existed to delete
  })
})

describe('change notifications', () => {
  it('forwards sign-in, account updates and sign-out', async () => {
    const seen: AuthEvent[] = []
    repos.auth.onChange((event) => seen.push(event))
    fake.on('POST', /\/auth\/v1\/token$/, { body: sessionBody(memberBody()) })
    fake.on('PUT', /\/auth\/v1\/user$/, { body: memberBody() })

    await repos.auth.signIn({ email: 'summer@example.com', password: 'correct horse' })
    await repos.auth.updatePassword('a brand new password')
    await repos.auth.signOut()

    await vi.waitFor(() => expect(seen).toEqual(['signed_in', 'updated', 'signed_out']))
  })

  it('stops notifying after unsubscribe', async () => {
    const listener = vi.fn()
    const stop = repos.auth.onChange(listener)
    stop()
    fake.on('POST', /\/auth\/v1\/token$/, { body: sessionBody(memberBody()) })
    await repos.auth.signIn({ email: 'summer@example.com', password: 'correct horse' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(listener).not.toHaveBeenCalled()
  })
})
