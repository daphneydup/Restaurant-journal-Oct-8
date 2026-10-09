import { screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Repositories } from '@/data'
import { createFakeSupabase, authUserBody } from '@/test/fakeSupabase'
import { newUser } from '@/test/helpers'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'

let repos: Repositories
const good = { email: 'summer@example.com', password: 'correct horse' }

beforeEach(() => {
  repos = createTestRepositories()
})

/** A member who exists but is currently logged out, for the log-in tests. */
async function seedAccountThenLogOut() {
  await repos.auth.signUp(good)
  await repos.auth.signOut()
}

describe('Log in', () => {
  it('shows labelled fields, links to the other account screens, and a guest notice', async () => {
    await renderApp('/login', { repositories: repos })
    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    )
    expect(await screen.findByText(/using a guest journal/i)).toBeInTheDocument()
  })

  it('explains what is missing without calling the server', async () => {
    const user = newUser()
    await renderApp('/login', { repositories: repos })
    await user.click(await screen.findByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInvalid()
    expect(screen.getByLabelText('Email')).toHaveFocus() // the first problem
  })

  it('logs in, welcomes you back and returns to My Spots', async () => {
    await seedAccountThenLogOut()
    const user = newUser()
    const { router } = await renderApp('/login', { repositories: repos })

    await user.type(await screen.findByLabelText('Email'), ' Summer@Example.com ')
    await user.type(screen.getByLabelText('Password'), good.password)
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Welcome back')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await repos.auth.getCurrentUser()).toMatchObject({ email: good.email, isGuest: false })
  })

  it('shows one message for a wrong password, and stays on the page', async () => {
    await seedAccountThenLogOut()
    const user = newUser()
    const { router } = await renderApp('/login', { repositories: repos })

    await user.type(await screen.findByLabelText('Email'), good.email)
    await user.type(screen.getByLabelText('Password'), 'wrong password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email and password don’t match',
    )
    expect(router.state.location.pathname).toBe('/login')
    expect(await repos.auth.getCurrentUser()).toBeNull()
  })

  it('tells you the service is down, not that your password is wrong', async () => {
    await seedAccountThenLogOut()
    const user = newUser()
    await renderApp('/login', { repositories: repos })
    await user.type(await screen.findByLabelText('Email'), good.email)
    await user.type(screen.getByLabelText('Password'), good.password)
    repos.dev?.setSimulateErrors(true)
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t log you in.*try again/i)
  })

  it('has a button to reveal the password, announced as pressed', async () => {
    const user = newUser()
    await renderApp('/login', { repositories: repos })
    const field = await screen.findByLabelText('Password')
    expect(field).toHaveAttribute('type', 'password')

    const toggle = screen.getByRole('button', { name: 'Show password' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(field).toHaveAttribute('type', 'text')
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('does not offer to log in again when already logged in', async () => {
    await repos.auth.signUp(good)
    await renderApp('/login', { repositories: repos })
    expect(await screen.findByText(/already logged in/i)).toHaveTextContent(good.email)
    expect(screen.getByRole('link', { name: 'Go to your account' })).toHaveAttribute(
      'href',
      '/account',
    )
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })
})

describe('Sign up (a guest becomes a member)', () => {
  async function fillSignUp(
    user: ReturnType<typeof newUser>,
    over: Partial<{ email: string; password: string; confirm: string }> = {},
  ) {
    await user.type(await screen.findByLabelText('Email'), over.email ?? good.email)
    await user.type(screen.getByLabelText('Password'), over.password ?? good.password)
    await user.type(
      screen.getByLabelText('Confirm password'),
      over.confirm ?? over.password ?? good.password,
    )
  }

  it('promises the journal comes along', async () => {
    await renderApp('/signup', { repositories: repos })
    expect(
      await screen.findByText(/everything you’ve logged so far comes with you/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password')
  })

  it('creates the account, keeps the same user and journal, and opens the account page', async () => {
    const guest = (await repos.auth.getCurrentUser())!
    const before = (await repos.restaurants.list()).length
    const user = newUser()
    const { router } = await renderApp('/signup', { repositories: repos })

    await fillSignUp(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Account created')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/account'))
    expect(await repos.auth.getCurrentUser()).toMatchObject({
      id: guest.id,
      email: good.email,
      isGuest: false,
    })
    expect(await repos.restaurants.list()).toHaveLength(before)
  })

  it('reports every problem at once, each next to its field', async () => {
    const user = newUser()
    await renderApp('/signup', { repositories: repos })
    await user.type(await screen.findByLabelText('Email'), 'nope')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('Type your password again')).toBeInTheDocument()
    expect(await repos.auth.getCurrentUser()).toMatchObject({ isGuest: true })
  })

  it('catches a mistyped confirmation', async () => {
    const user = newUser()
    await renderApp('/signup', { repositories: repos })
    await fillSignUp(user, { confirm: 'correct horsE' })
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('The passwords don’t match')).toBeInTheDocument()
  })

  it('points people with an existing account to log in', async () => {
    await seedAccountThenLogOut()
    const user = newUser()
    await renderApp('/signup', { repositories: repos })
    await fillSignUp(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists.*logging in/i)
  })

  it('shows "check your email" when the project needs the address confirmed first', async () => {
    const fake = createFakeSupabase()
    fake.on('PUT', /\/auth\/v1\/user$/, {
      body: authUserBody({ new_email: good.email, email: '' }),
    })
    const user = newUser()
    await renderApp('/signup', { repositories: fake.repositories() })

    await fillSignUp(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByText(good.email)).toBeInTheDocument()
    expect(screen.getByText(/journal is safe in the meantime/i)).toBeInTheDocument()
  })

  it('does not offer sign-up to someone who already has an account', async () => {
    await repos.auth.signUp(good)
    await renderApp('/signup', { repositories: repos })
    expect(await screen.findByText(/You already have an account/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument()
  })
})

describe('Forgot password', () => {
  it('says the same thing whether or not the address has an account', async () => {
    await repos.auth.signUp(good)
    for (const email of [good.email, 'nobody@example.com']) {
      const user = newUser()
      const { unmount } = await renderApp('/forgot-password', { repositories: repos })
      await user.type(await screen.findByLabelText('Email'), email)
      await user.click(screen.getByRole('button', { name: 'Send reset link' }))

      expect(await screen.findByText(/If there’s an account for/)).toHaveTextContent(email)
      unmount()
    }
  })

  it('is honest that demo mode sends no email', async () => {
    const user = newUser()
    await renderApp('/forgot-password', { repositories: repos })
    await user.type(await screen.findByLabelText('Email'), good.email)
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText(/no email is actually sent/i)).toBeInTheDocument()
  })

  it('asks the real service to send the link when using Supabase', async () => {
    const fake = createFakeSupabase()
    fake.on('POST', /\/auth\/v1\/recover$/, { body: {} })
    const user = newUser()
    await renderApp('/forgot-password', { repositories: fake.repositories() })

    await user.type(await screen.findByLabelText('Email'), good.email)
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText(/If there’s an account for/)).toBeInTheDocument()
    expect(screen.queryByText(/no email is actually sent/i)).not.toBeInTheDocument()
    expect(fake.calls.some((c) => c.path.endsWith('/auth/v1/recover'))).toBe(true)
  })

  it('validates the address and reports failures', async () => {
    const user = newUser()
    await renderApp('/forgot-password', { repositories: repos })
    await user.type(await screen.findByLabelText('Email'), 'nope')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), good.email)
    repos.dev?.setSimulateErrors(true)
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t send the reset link/i)
  })
})

describe('Reset password', () => {
  /** The same repositories, but behaving as if the user just clicked the emailed link. */
  const recovering = (base: Repositories): Repositories => ({
    ...base,
    auth: { ...base.auth, isRecovering: () => true },
  })

  it('explains an expired or already-used link, and offers a new one', async () => {
    await renderApp('/reset-password', { repositories: repos })
    expect(await screen.findByText(/expired or was already used/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Send me a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })

  it('lets someone arriving from the email link choose a new password', async () => {
    await repos.auth.signUp(good)
    const user = newUser()
    const { router } = await renderApp('/reset-password', { repositories: recovering(repos) })

    await user.type(await screen.findByLabelText('New password'), 'a brand new password')
    await user.type(screen.getByLabelText('Confirm new password'), 'a brand new password')
    await user.click(screen.getByRole('button', { name: 'Save new password' }))

    expect(await screen.findByText('Password updated')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/account'))
    await repos.auth.signOut()
    await expect(
      repos.auth.signIn({ email: good.email, password: 'a brand new password' }),
    ).resolves.toBeDefined()
    await expect(repos.auth.signIn(good)).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('applies the same password rules', async () => {
    await repos.auth.signUp(good)
    const user = newUser()
    await renderApp('/reset-password', { repositories: recovering(repos) })
    await user.type(await screen.findByLabelText('New password'), 'short')
    await user.type(screen.getByLabelText('Confirm new password'), 'different')
    await user.click(screen.getByRole('button', { name: 'Save new password' }))
    expect(await screen.findByText('Use at least 8 characters')).toBeInTheDocument()
    expect(screen.getByText('The passwords don’t match')).toBeInTheDocument()
  })
})
