import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repositories } from '@/data'
import { forgetReferral, pendingReferral, rememberReferral } from '@/lib/pendingReferral'
import { authUserBody, createFakeSupabase } from '@/test/fakeSupabase'
import { newUser } from '@/test/helpers'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'

/**
 * Whole journeys through the real screens and router, rather than one screen at a time: the
 * places where sign-up, log-in, log-out, deletion, invites and points have to agree with each
 * other.
 */
let repos: Repositories
const good = { email: 'summer@example.com', password: 'correct horse' }
const CODE = 'TFE-ABC234'

beforeEach(() => {
  repos = createTestRepositories()
  forgetReferral()
})

async function fillSignUp(user: ReturnType<typeof newUser>) {
  await user.type(await screen.findByLabelText('Email'), good.email)
  await user.type(screen.getByLabelText('Password'), good.password)
  await user.type(screen.getByLabelText('Confirm password'), good.password)
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

async function logIn(user: ReturnType<typeof newUser>) {
  await user.type(await screen.findByLabelText('Email'), good.email)
  await user.type(screen.getByLabelText('Password'), good.password)
  await user.click(screen.getByRole('button', { name: 'Log in' }))
}

describe('a person’s whole account life, by clicking', () => {
  it('guest -> sign up -> log out -> log in -> delete, ending as a fresh guest', async () => {
    const user = newUser()
    const guest = (await repos.auth.getCurrentUser())!
    const spots = (await repos.restaurants.list()).length
    const { router } = await renderApp('/', { repositories: repos })

    // 1. A guest with a journal is invited to keep it.
    const banner = await screen.findByRole('complementary', { name: 'Save your journal' })
    await user.click(within(banner).getByRole('link', { name: 'Create an account' }))
    await fillSignUp(user)
    await waitFor(() => expect(router.state.location.pathname).toBe('/account'))
    expect(await repos.auth.getCurrentUser()).toMatchObject({ id: guest.id, isGuest: false })

    // 2. Logging out leaves the account in place.
    await user.click(await screen.findByRole('button', { name: 'Log out' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await repos.auth.getCurrentUser()).toBeNull()

    // 3. Logging back in from the side navigation.
    const side = screen.getByRole('navigation', { name: 'Primary' })
    await user.click(await within(side).findByRole('link', { name: 'Log in or sign up' }))
    await logIn(user)
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await repos.auth.getCurrentUser()).toMatchObject({ email: good.email, isGuest: false })

    // 4. Deleting the account removes it and the journal, and a new guest starts clean.
    await router.navigate('/account')
    await user.click(await screen.findByRole('button', { name: 'Delete account' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE')
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await expect(repos.auth.signIn(good)).rejects.toMatchObject({ code: 'invalid_credentials' })
    expect(await repos.restaurants.list()).toHaveLength(0)
    expect(spots).toBeGreaterThan(0)
  })
})

describe('points and account changes', () => {
  it('keeps a guest’s points and vouchers when they create an account', async () => {
    const user = newUser()
    const before = await repos.rewards.getSummary()
    const vouchers = await repos.rewards.listVouchers()
    await renderApp('/signup', { repositories: repos })
    await fillSignUp(user)
    await screen.findByText('Account created')

    expect(await repos.rewards.getSummary()).toEqual(before)
    expect(await repos.rewards.listVouchers()).toEqual(vouchers)
  })

  it('refreshes the points on screen when someone logs out, instead of showing stale ones', async () => {
    await repos.auth.signUp(good)
    const getSummary = vi.spyOn(repos.rewards, 'getSummary')
    await renderApp('/', { repositories: repos })
    await screen.findByRole('link', { name: /points, open Rewards/ })
    const calls = getSummary.mock.calls.length

    await repos.auth.signOut()
    await waitFor(() => expect(getSummary.mock.calls.length).toBeGreaterThan(calls))
  })

  it('does not keep points after the account is deleted', async () => {
    await repos.auth.signUp(good)
    expect((await repos.rewards.getSummary()).balance).toBeGreaterThan(0)
    await repos.auth.deleteAccount()
    expect(await repos.rewards.getSummary()).toMatchObject({ balance: 0, entries: [] })
    expect(await repos.rewards.listVouchers()).toEqual([])
  })
})

describe('arriving with a friend’s invite', () => {
  it('sign-up through the form claims the bonus automatically and forgets the code', async () => {
    const user = newUser()
    const before = (await repos.rewards.getSummary()).balance
    await renderApp(`/join?ref=${CODE}`, { repositories: repos })
    await user.click(await screen.findByRole('link', { name: 'Create my account' }))
    expect(await screen.findByText(/friend’s invite is waiting/)).toBeInTheDocument()

    await fillSignUp(user)
    expect(await screen.findByText(/Welcome bonus: 200 points added/)).toBeInTheDocument()
    expect((await repos.rewards.getSummary()).balance).toBe(before + 200)
    expect(pendingReferral()).toBeNull()
    expect(await repos.rewards.getReferral()).toMatchObject({ hasClaimed: true })
  })

  it('logging in to an existing account claims it too', async () => {
    await repos.auth.signUp(good)
    await repos.auth.signOut()
    const user = newUser()
    const before = (await repos.rewards.getSummary()).balance
    rememberReferral(CODE)
    await renderApp('/login', { repositories: repos })
    expect(pendingReferral()).toBe(CODE) // a guest: nothing yet

    await logIn(user)
    await waitFor(() => expect(pendingReferral()).toBeNull())
    expect((await repos.rewards.getSummary()).balance).toBe(before + 200)
  })

  it('says so, and pays nothing more, when the member already used an invite', async () => {
    await repos.auth.signUp(good)
    await repos.rewards.claimReferral('TFE-GHJKMN')
    const before = (await repos.rewards.getSummary()).balance
    rememberReferral(CODE)
    await renderApp('/', { repositories: repos })

    expect(
      await screen.findByText(/already used an invite, so this one wasn’t applied/),
    ).toBeInTheDocument()
    expect((await repos.rewards.getSummary()).balance).toBe(before)
    expect(pendingReferral()).toBeNull()
  })

  it('does not apply your own code when you open your own link', async () => {
    await repos.auth.signUp(good)
    const { code } = await repos.rewards.getReferral()
    const before = (await repos.rewards.getSummary()).balance
    await renderApp(`/join?ref=${code}`, { repositories: repos })

    expect(await screen.findByText(/can’t use your own invite code/)).toBeInTheDocument()
    expect((await repos.rewards.getSummary()).balance).toBe(before)
    expect(pendingReferral()).toBeNull()
  })

  it('waits while the email still needs confirming: kept, and nothing claimed yet', async () => {
    const fake = createFakeSupabase()
    fake.on('PUT', /\/auth\/v1\/user$/, {
      body: authUserBody({ new_email: good.email, email: '' }),
    })
    const user = newUser()
    rememberReferral(CODE)
    await renderApp('/signup', { repositories: fake.repositories() })

    await fillSignUp(user)
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(pendingReferral()).toBe(CODE)
    expect(fake.dataCalls().some((c) => c.path.endsWith('/rpc/claim_referral'))).toBe(false)
  })
})
