import { QueryClient } from '@tanstack/react-query'
import { act, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import type { AuthEvent, Repositories } from '@/data'
import { queryKeys } from '@/hooks/queries'
import { newUser } from '@/test/helpers'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'
import type { AuthUser } from '@/types'

let repos: Repositories
const good = { email: 'summer@example.com', password: 'correct horse' }

beforeEach(() => {
  repos = createTestRepositories()
})

describe('Guest banner on My Spots', () => {
  it('nudges a guest who has a journal worth keeping', async () => {
    await renderApp('/', { repositories: repos })
    const banner = await screen.findByRole('complementary', { name: 'Save your journal' })
    expect(banner).toHaveTextContent('saved only in this browser')
    // "Account" is what you see; screen readers hear what it does.
    const signUp = within(banner).getByRole('link', { name: 'Create an account' })
    expect(signUp).toHaveTextContent('Account')
    expect(signUp).toHaveAttribute('href', '/signup')
    expect(within(banner).getByRole('link', { name: 'Login' })).toHaveAttribute('href', '/login')
    expect(within(banner).getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  it('goes away when dismissed, and stays away on the next visit', async () => {
    const user = newUser()
    const first = await renderApp('/', { repositories: repos })
    await user.click(await screen.findByRole('button', { name: 'Dismiss' }))
    expect(
      screen.queryByRole('complementary', { name: 'Save your journal' }),
    ).not.toBeInTheDocument()
    first.unmount()

    await renderApp('/', { repositories: createTestRepositories() })
    await screen.findByRole('heading', { name: 'Ember & Orchard' })
    expect(
      screen.queryByRole('complementary', { name: 'Save your journal' }),
    ).not.toBeInTheDocument()
  })

  it('is not shown to members', async () => {
    await repos.auth.signUp(good)
    await renderApp('/', { repositories: repos })
    await screen.findByRole('heading', { name: 'Ember & Orchard' })
    expect(
      screen.queryByRole('complementary', { name: 'Save your journal' }),
    ).not.toBeInTheDocument()
  })

  it('is not shown when there is nothing to keep yet', async () => {
    for (const r of await repos.restaurants.list()) await repos.restaurants.remove(r.id)
    await renderApp('/', { repositories: repos })
    await screen.findByRole('heading', { name: 'No spots yet' })
    expect(
      screen.queryByRole('complementary', { name: 'Save your journal' }),
    ).not.toBeInTheDocument()
  })
})

describe('Profile: account summary', () => {
  it('offers a guest the ways in', async () => {
    await renderApp('/profile', { repositories: repos })
    expect(
      await screen.findByRole('heading', { name: 'You’re using a guest journal' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    )
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })

  it('shows who a member is logged in as, with a way to manage it', async () => {
    await repos.auth.signUp(good)
    await renderApp('/profile', { repositories: repos })
    expect(
      await screen.findByRole('heading', { name: `Logged in as ${good.email}` }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage account' })).toHaveAttribute('href', '/account')
    expect(screen.queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument()
  })
})

describe('Side navigation', () => {
  const sideNav = () => screen.getByRole('navigation', { name: 'Primary' })

  it('invites a guest to log in or sign up', async () => {
    await renderApp('/', { repositories: repos })
    expect(
      await within(sideNav()).findByRole('link', { name: 'Log in or sign up' }),
    ).toHaveAttribute('href', '/login')
  })

  it('shows a member their account and email', async () => {
    await repos.auth.signUp(good)
    await renderApp('/', { repositories: repos })
    const link = await within(sideNav()).findByRole('link', { name: /Account/ })
    expect(link).toHaveAttribute('href', '/account')
    expect(link).toHaveTextContent(good.email)
  })
})

describe('AuthSync: never show one person another person’s data', () => {
  /** Repositories whose auth events the test controls. */
  function controllable(initial: AuthUser | null) {
    const listeners = new Set<(event: AuthEvent, user: AuthUser | null) => void>()
    const base = createTestRepositories()
    const repositories: Repositories = {
      ...base,
      auth: {
        ...base.auth,
        getCurrentUser: async () => initial,
        onChange: (listener) => {
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
      },
    }
    return {
      repositories,
      emit: (event: AuthEvent, user: AuthUser | null) =>
        act(() => listeners.forEach((l) => l(event, user))),
    }
  }

  const person = (id: string, over: Partial<AuthUser> = {}): AuthUser => ({
    id,
    email: `${id}@example.com`,
    pendingEmail: null,
    isGuest: false,
    createdAt: '2026-10-01T12:00:00.000Z',
    ...over,
  })

  async function mount(initial: AuthUser | null) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const ctl = controllable(initial)
    render(
      <AppProviders repositories={ctl.repositories} queryClient={client}>
        <div />
      </AppProviders>,
    )
    await act(async () => {}) // let AuthSync learn who is signed in
    client.setQueryData(queryKeys.restaurants.list(), [{ id: 'mine' }])
    client.setQueryData(queryKeys.visits.list(), [{ id: 'my-visit' }])
    return { client, ...ctl }
  }

  it('clears every cached screen when someone logs out', async () => {
    const { client, emit } = await mount(person('a'))
    await emit('signed_out', null)
    expect(client.getQueryData(queryKeys.restaurants.list())).toBeUndefined()
    expect(client.getQueryData(queryKeys.visits.list())).toBeUndefined()
    expect(client.getQueryData(queryKeys.account.current())).toBeNull()
  })

  it('clears them when a different person logs in', async () => {
    const { client, emit } = await mount(person('a'))
    await emit('signed_in', person('b'))
    expect(client.getQueryData(queryKeys.restaurants.list())).toBeUndefined()
    expect(client.getQueryData(queryKeys.account.current())).toMatchObject({ id: 'b' })
  })

  it('keeps them when the same person just changes their email or password', async () => {
    const { client, emit } = await mount(person('a'))
    await emit('updated', person('a', { email: 'new@example.com' }))
    expect(client.getQueryData(queryKeys.restaurants.list())).toEqual([{ id: 'mine' }])
    expect(client.getQueryData(queryKeys.account.current())).toMatchObject({
      email: 'new@example.com',
    })
  })

  it('keeps them when a guest becomes a member in place (same id: the journal comes along)', async () => {
    const { client, emit } = await mount(person('g', { isGuest: true, email: null }))
    await emit('updated', person('g'))
    expect(client.getQueryData(queryKeys.restaurants.list())).toEqual([{ id: 'mine' }])
    expect(client.getQueryData(queryKeys.account.current())).toMatchObject({
      id: 'g',
      isGuest: false,
    })
  })

  it('keeps them for a repeated sign-in event of the same person (token refresh)', async () => {
    const { client, emit } = await mount(person('a'))
    await emit('signed_in', person('a'))
    expect(client.getQueryData(queryKeys.restaurants.list())).toEqual([{ id: 'mine' }])
  })

  it('keeps them when the very first guest session starts (nothing to discard)', async () => {
    const { client, emit } = await mount(null)
    await emit('signed_in', person('guest', { isGuest: true, email: null }))
    expect(client.getQueryData(queryKeys.restaurants.list())).toEqual([{ id: 'mine' }])
  })

  it('stops listening when the app unmounts', async () => {
    const listeners = vi.fn()
    const base = createTestRepositories()
    const repositories: Repositories = {
      ...base,
      auth: { ...base.auth, onChange: (l) => (listeners(l), () => listeners('unsubscribed')) },
    }
    const { unmount } = render(
      <AppProviders repositories={repositories} queryClient={new QueryClient()}>
        <div />
      </AppProviders>,
    )
    unmount()
    expect(listeners).toHaveBeenLastCalledWith('unsubscribed')
  })
})
