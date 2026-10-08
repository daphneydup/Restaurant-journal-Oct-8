import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repositories } from '@/data'
import { freezeToday, newUser } from '@/test/helpers'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'

let repos: Repositories

beforeEach(() => {
  freezeToday()
  repos = createTestRepositories()
})
afterEach(() => vi.useRealTimers())

async function openProfile() {
  const user = newUser()
  const utils = await renderApp('/profile', { repositories: repos })
  await screen.findByRole('textbox', { name: 'Display name' })
  return { user, ...utils }
}

describe('Profile', () => {
  it('shows a loading state, then the saved profile', async () => {
    await renderApp('/profile', { repositories: createTestRepositories({ latencyMs: 150 }) })
    expect(screen.getByText('Loading your profile')).toBeInTheDocument()

    expect(await screen.findByRole('textbox', { name: 'Display name' })).toHaveValue('Summer')
    expect(screen.getByRole('textbox', { name: 'Home city' })).toHaveValue('Dallas')
    expect(screen.getByRole('button', { name: 'Vegan' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Steak' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Gluten-free' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('offers every diet from the data as a default', async () => {
    await openProfile()
    for (const lens of await repos.lenses.list()) {
      expect(screen.getByRole('button', { name: lens.shortLabel })).toBeInTheDocument()
    }
  })

  it('only enables Save once something changed', async () => {
    const { user } = await openProfile()
    const save = screen.getByRole('button', { name: 'Save profile' })
    expect(save).toBeDisabled()
    await user.type(screen.getByRole('textbox', { name: 'Display name' }), 'x')
    expect(save).toBeEnabled()
  })

  it('saves a new name, city and default diets', async () => {
    const { user } = await openProfile()
    const name = screen.getByRole('textbox', { name: 'Display name' })
    const city = screen.getByRole('textbox', { name: 'Home city' })
    await user.clear(name)
    await user.type(name, 'Sam')
    await user.clear(city)
    await user.type(city, 'Austin')
    await user.click(screen.getByRole('button', { name: 'Steak' })) // off
    await user.click(screen.getByRole('button', { name: 'Gluten-free' })) // on
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Profile saved')).toBeInTheDocument()
    expect(await repos.user.getCurrent()).toMatchObject({
      displayName: 'Sam',
      homeCity: 'Austin',
      defaultLensIds: ['vegan', 'gluten-free'],
    })
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled() // clean again
  })

  it('uses the saved diets as the starting point on the other screens', async () => {
    const { user } = await openProfile()
    await user.click(screen.getByRole('button', { name: 'Steak' }))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await screen.findByText('Profile saved')

    await user.click(
      within(screen.getByRole('navigation', { name: 'Primary, mobile' })).getByRole('link', {
        name: /Plan/,
      }),
    )
    await screen.findByRole('heading', { level: 2, name: 'Your shortlist' })
    expect(screen.getByRole('button', { name: 'Steak' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Vegan' })).toHaveAttribute('aria-pressed', 'true')
  })

  describe('validation', () => {
    it('requires a name and a city, with messages next to the fields', async () => {
      const { user } = await openProfile()
      await user.clear(screen.getByRole('textbox', { name: 'Display name' }))
      await user.clear(screen.getByRole('textbox', { name: 'Home city' }))
      await user.click(screen.getByRole('button', { name: 'Save profile' }))

      expect(await screen.findByText('Enter your name')).toBeInTheDocument()
      expect(screen.getByText('Enter your home city')).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Display name' })).toBeInvalid()
      expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveAccessibleDescription(
        'Enter your name',
      )
      expect(await repos.user.getCurrent()).toMatchObject({
        displayName: 'Summer',
        homeCity: 'Dallas',
      })
    })

    it('clears the message once fixed', async () => {
      const { user } = await openProfile()
      const name = screen.getByRole('textbox', { name: 'Display name' })
      await user.clear(name)
      await user.click(screen.getByRole('button', { name: 'Save profile' }))
      await screen.findByText('Enter your name')
      await user.type(name, 'Sam')
      await waitFor(() => expect(screen.queryByText('Enter your name')).not.toBeInTheDocument())
    })
  })

  it('tells you when saving fails and keeps your edits', async () => {
    const { user } = await openProfile()
    await user.type(screen.getByRole('textbox', { name: 'Display name' }), '!')
    repos.dev?.setSimulateErrors(true)
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText(/couldn’t save your profile/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('Summer!')
  })

  it('shows an error with retry, then recovers', async () => {
    repos.dev?.setSimulateErrors(true)
    const user = newUser()
    await renderApp('/profile', { repositories: repos })
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load your profile')

    repos.dev?.setSimulateErrors(false)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('textbox', { name: 'Display name' })).toBeInTheDocument()
  })
})

describe('Profile: demo data tools', () => {
  it('turns simulated errors on and off', async () => {
    const { user } = await openProfile()
    const toggle = screen.getByRole('switch', { name: /Simulate network errors/ })
    expect(toggle).not.toBeChecked()

    await user.click(toggle)
    expect(repos.dev?.isSimulatingErrors()).toBe(true)
    await user.click(toggle)
    expect(repos.dev?.isSimulatingErrors()).toBe(false)
  })

  it('shows the error screens everywhere while simulating', async () => {
    const { user } = await openProfile()
    await user.click(screen.getByRole('switch', { name: /Simulate network errors/ }))
    await user.click(
      within(screen.getByRole('navigation', { name: 'Primary, mobile' })).getByRole('link', {
        name: 'My Spots',
      }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load your spots')
  })

  it('restores the demo data after confirmation', async () => {
    const { user } = await openProfile()
    await repos.restaurants.remove('r-ember')
    await repos.user.update({ displayName: 'Changed' })

    await user.click(screen.getByRole('button', { name: 'Reset demo data' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reset demo data?' })
    await user.click(within(dialog).getByRole('button', { name: 'Reset data' }))

    expect(await screen.findByText('Demo data restored')).toBeInTheDocument()
    expect(await repos.restaurants.getById('r-ember')).not.toBeNull()
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Display name' })).toHaveValue('Summer'),
    )
  })

  it('does nothing when you cancel the reset', async () => {
    const { user } = await openProfile()
    await repos.restaurants.remove('r-ember')
    await user.click(screen.getByRole('button', { name: 'Reset demo data' }))
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel' }),
    )
    expect(await repos.restaurants.getById('r-ember')).toBeNull()
  })

  it('is hidden when the data layer has no dev controls (a real back end)', async () => {
    const { dev, ...withoutDev } = repos
    void dev
    await renderApp('/profile', { repositories: withoutDev })
    await screen.findByRole('textbox', { name: 'Display name' })
    expect(screen.queryByRole('heading', { name: 'Demo data' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset demo data' })).not.toBeInTheDocument()
  })
})
