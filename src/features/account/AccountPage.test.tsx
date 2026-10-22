import { screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Repositories } from '@/data'
import { authUserBody, createFakeSupabase, memberBody } from '@/test/fakeSupabase'
import { newUser } from '@/test/helpers'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'

let repos: Repositories
const good = { email: 'summer@example.com', password: 'correct horse' }

beforeEach(() => {
  repos = createTestRepositories()
})

const section = (title: string) =>
  screen.getByRole('heading', { level: 2, name: title }).closest('div')!

describe('Account: READ', () => {
  it('shows a loading state, then the guest status with the way to create an account', async () => {
    await renderApp('/account', { repositories: createTestRepositories({ latencyMs: 500 }) })
    expect(screen.getByText('Loading your account')).toBeInTheDocument()

    const status = await screen.findByRole('heading', { level: 2, name: 'Your account' })
    const card = status.closest('div')!
    expect(card).toHaveTextContent('Status')
    expect(card).toHaveTextContent('Guest')
    expect(card).toHaveTextContent('None yet')
    expect(within(card).getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    )
    expect(within(card).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
  })

  it('shows a member’s email and join date', async () => {
    await repos.auth.signUp(good)
    await renderApp('/account', { repositories: repos })
    const card = (await screen.findByRole('heading', { level: 2, name: 'Your account' })).closest(
      'div',
    )!
    expect(card).toHaveTextContent('Member')
    expect(card).toHaveTextContent(good.email)
    expect(card).toHaveTextContent(/Member since\s*[A-Z][a-z]+ \d+, \d{4}/)
  })

  it('shows an email address that is waiting to be confirmed', async () => {
    const fake = createFakeSupabase()
    fake.on('POST', /\/auth\/v1\/token$/, {
      body: {
        access_token: 'x.y.z',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: 4_000_000_000,
        refresh_token: 'r',
        user: memberBody(good.email, { new_email: 'new@example.com' }),
      },
    })
    const supa = fake.repositories()
    await supa.auth.signIn(good)
    await renderApp('/account', { repositories: supa })
    expect(await screen.findByText('new@example.com')).toBeInTheDocument()
    expect(screen.getByText(/once you click the link we emailed/i)).toBeInTheDocument()
  })

  it('shows an error with retry, then recovers', async () => {
    repos.dev?.setSimulateErrors(true)
    const user = newUser()
    await renderApp('/account', { repositories: repos })
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load your account')

    repos.dev?.setSimulateErrors(false)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Your account' }),
    ).toBeInTheDocument()
  })
})

describe('Account: guests', () => {
  it('cannot change email or password (they create an account first)', async () => {
    await renderApp('/account', { repositories: repos })
    await screen.findByRole('heading', { level: 2, name: 'Your account' })
    expect(screen.queryByRole('heading', { name: 'Change email' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Change password' })).not.toBeInTheDocument()
  })

  it('is warned before leaving a guest session, and can stay', async () => {
    const user = newUser()
    await renderApp('/account', { repositories: repos })
    await user.click(await screen.findByRole('button', { name: 'Leave guest session' }))

    const dialog = await screen.findByRole('dialog', { name: 'Leave this guest session?' })
    expect(dialog).toHaveTextContent(/create an account first/i)
    await user.click(within(dialog).getByRole('button', { name: 'Stay' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await repos.auth.getCurrentUser()).not.toBeNull()
  })

  it('can leave anyway', async () => {
    const user = newUser()
    const { router } = await renderApp('/account', { repositories: repos })
    await user.click(await screen.findByRole('button', { name: 'Leave guest session' }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Leave and lose this journal',
      }),
    )

    expect(await screen.findByText('You’re logged out')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await repos.auth.getCurrentUser()).toBeNull()
  })
})

describe('Account: UPDATE email', () => {
  async function openAsMember() {
    await repos.auth.signUp(good)
    const user = newUser()
    const utils = await renderApp('/account', { repositories: repos })
    await screen.findByRole('heading', { level: 2, name: 'Change email' })
    return { user, ...utils }
  }

  it('changes the email and shows it straight away', async () => {
    const { user } = await openAsMember()
    await user.type(screen.getByLabelText('New email'), ' New@Example.com ')
    await user.click(screen.getByRole('button', { name: 'Change email' }))

    expect(await screen.findByText('Email updated')).toBeInTheDocument()
    await waitFor(() => expect(section('Your account')).toHaveTextContent('new@example.com'))
    expect((await repos.auth.getCurrentUser())?.email).toBe('new@example.com')
    expect(screen.getByLabelText('New email')).toHaveValue('') // form cleared
  })

  it('says a confirmation is needed when the project requires it', async () => {
    const fake = createFakeSupabase()
    fake.on('POST', /\/auth\/v1\/token$/, {
      body: {
        access_token: 'x.y.z',
        token_type: 'bearer',
        expires_in: 3600,
        expires_at: 4_000_000_000,
        refresh_token: 'r',
        user: memberBody(good.email),
      },
    })
    fake.on('PUT', /\/auth\/v1\/user$/, {
      body: memberBody(good.email, { new_email: 'new@example.com' }),
    })
    const supa = fake.repositories()
    await supa.auth.signIn(good)
    const user = newUser()
    await renderApp('/account', { repositories: supa })

    await user.type(await screen.findByLabelText('New email'), 'new@example.com')
    await user.click(screen.getByRole('button', { name: 'Change email' }))
    expect(await screen.findByText(/sent a confirmation link to/i)).toHaveTextContent(
      'new@example.com',
    )
  })

  it('rejects a malformed address, and one that belongs to someone else', async () => {
    await repos.auth.signOut()
    await repos.auth.signUp({ email: 'other@example.com', password: 'other password' })
    await repos.auth.signOut()
    await repos.auth.signUp(good)
    const user = newUser()
    await renderApp('/account', { repositories: repos })

    await user.type(await screen.findByLabelText('New email'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Change email' }))
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('New email'))
    await user.type(screen.getByLabelText('New email'), 'other@example.com')
    await user.click(screen.getByRole('button', { name: 'Change email' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/already uses that email/i)
  })
})

describe('Account: UPDATE password', () => {
  it('changes the password; the old one stops working', async () => {
    await repos.auth.signUp(good)
    const user = newUser()
    await renderApp('/account', { repositories: repos })

    const form = (
      await screen.findByRole('heading', { level: 2, name: 'Change password' })
    ).closest('div')!
    await user.type(within(form).getByLabelText('New password'), 'a brand new password')
    await user.type(within(form).getByLabelText('Confirm new password'), 'a brand new password')
    await user.click(within(form).getByRole('button', { name: 'Change password' }))

    expect(await screen.findByText('Password updated')).toBeInTheDocument()
    expect(within(form).getByLabelText('New password')).toHaveValue('')
    await repos.auth.signOut()
    await expect(repos.auth.signIn(good)).rejects.toMatchObject({ code: 'invalid_credentials' })
    await expect(
      repos.auth.signIn({ email: good.email, password: 'a brand new password' }),
    ).resolves.toBeDefined()
  })

  it('validates length and matching', async () => {
    await repos.auth.signUp(good)
    const user = newUser()
    await renderApp('/account', { repositories: repos })
    const form = (
      await screen.findByRole('heading', { level: 2, name: 'Change password' })
    ).closest('div')!
    await user.type(within(form).getByLabelText('New password'), 'short')
    await user.type(within(form).getByLabelText('Confirm new password'), 'other')
    await user.click(within(form).getByRole('button', { name: 'Change password' }))

    expect(await within(form).findByText('Use at least 8 characters')).toBeInTheDocument()
    expect(within(form).getByText('The passwords don’t match')).toBeInTheDocument()
  })

  it('shows why when the service refuses', async () => {
    await repos.auth.signUp(good)
    const user = newUser()
    await renderApp('/account', { repositories: repos })
    const form = (
      await screen.findByRole('heading', { level: 2, name: 'Change password' })
    ).closest('div')!
    await user.type(within(form).getByLabelText('New password'), 'a brand new password')
    await user.type(within(form).getByLabelText('Confirm new password'), 'a brand new password')
    repos.dev?.setSimulateErrors(true)
    await user.click(within(form).getByRole('button', { name: 'Change password' }))
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      /couldn’t change your password/i,
    )
  })
})

describe('Account: log out', () => {
  it('logs a member out straight away and returns to My Spots', async () => {
    await repos.auth.signUp(good)
    const user = newUser()
    const { router } = await renderApp('/account', { repositories: repos })

    await user.click(await screen.findByRole('button', { name: 'Log out' }))
    expect(await screen.findByText('You’re logged out')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await repos.auth.getCurrentUser()).toBeNull()
    // Their account still exists: logging back in works.
    await expect(repos.auth.signIn(good)).resolves.toBeDefined()
  })
})

describe('Account: DELETE', () => {
  async function openDeleteDialog(user: ReturnType<typeof newUser>, label: string) {
    await user.click(await screen.findByRole('button', { name: label }))
    return screen.findByRole('dialog')
  }

  it('needs the word DELETE typed, then removes the account and its journal', async () => {
    await repos.auth.signUp(good)
    const user = newUser()
    const { router } = await renderApp('/account', { repositories: repos })
    const dialog = await openDeleteDialog(user, 'Delete account')
    expect(dialog).toHaveTextContent('This can’t be undone')

    // Nothing happens without the right word.
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }))
    expect(
      await within(dialog).findByText(/That doesn’t match. Type DELETE exactly/),
    ).toBeInTheDocument()
    expect((await repos.restaurants.list()).length).toBeGreaterThan(0)

    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE')
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }))

    expect(await screen.findByText('Your account was deleted')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await repos.restaurants.list()).toEqual([])
    expect(await repos.auth.getCurrentUser()).toBeNull()
    await expect(repos.auth.signIn(good)).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('can be cancelled without deleting anything', async () => {
    await repos.auth.signUp(good)
    const user = newUser()
    await renderApp('/account', { repositories: repos })
    const dialog = await openDeleteDialog(user, 'Delete account')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((await repos.restaurants.list()).length).toBeGreaterThan(0)
    expect(await repos.auth.getCurrentUser()).toMatchObject({ email: good.email })
  })

  it('keeps the dialog open and says why when deleting fails', async () => {
    await repos.auth.signUp(good)
    const user = newUser()
    await renderApp('/account', { repositories: repos })
    const dialog = await openDeleteDialog(user, 'Delete account')
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE')
    repos.dev?.setSimulateErrors(true)
    await user.click(within(dialog).getByRole('button', { name: 'Delete my account' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      /couldn’t delete your account/i,
    )
    repos.dev?.setSimulateErrors(false)
    expect((await repos.restaurants.list()).length).toBeGreaterThan(0)
  })

  it('lets a guest delete their journal, with words that fit', async () => {
    const user = newUser()
    await renderApp('/account', { repositories: repos })
    const dialog = await openDeleteDialog(user, 'Delete guest journal')
    expect(dialog).toHaveTextContent(/guest journal will be permanently deleted/i)
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE')
    await user.click(within(dialog).getByRole('button', { name: 'Delete my journal' }))

    expect(await screen.findByText('Your journal was deleted')).toBeInTheDocument()
    expect(await repos.restaurants.list()).toEqual([])
  })

  it('deletes through the real service when using Supabase', async () => {
    const fake = createFakeSupabase()
    fake.on('POST', /\/rest\/v1\/rpc\/delete_my_account$/, { status: 204 })
    fake.on('GET', /\/rest\/v1\/restaurants$/, { body: [] })
    const supa = fake.repositories()
    await supa.restaurants.list() // starts the guest session
    const user = newUser()
    await renderApp('/account', { repositories: supa })

    const dialog = await openDeleteDialog(user, 'Delete guest journal')
    await user.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'DELETE')
    await user.click(within(dialog).getByRole('button', { name: 'Delete my journal' }))

    expect(await screen.findByText('Your journal was deleted')).toBeInTheDocument()
    expect(fake.dataCalls().some((c) => c.path.endsWith('/rpc/delete_my_account'))).toBe(true)
    void authUserBody
  })
})
