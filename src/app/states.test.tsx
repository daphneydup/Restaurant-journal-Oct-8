import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { newUser } from '@/test/helpers'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'

/**
 * Every screen that loads data must show a loading state while it waits and an error state
 * (with a way to retry) when it fails. This guards against adding a screen that has neither.
 */
const DATA_SCREENS = [
  { name: 'My Spots', path: '/' },
  { name: 'Restaurant detail', path: '/spots/r-ember' },
  { name: 'Log a Visit', path: '/log' },
  { name: 'Go Back', path: '/go-back' },
  { name: 'Plan a Night Out', path: '/plan' },
  { name: 'Share (restaurant)', path: '/share/restaurant/r-ember' },
  { name: 'Share (dish)', path: '/share/dish/d-1' },
  { name: 'Rewards', path: '/rewards' },
  { name: 'Invite friends', path: '/invite' },
  { name: 'Profile', path: '/profile' },
  { name: 'Account', path: '/account' },
]

describe.each(DATA_SCREENS)('$name', ({ path }) => {
  it('shows a loading state while data is on its way', async () => {
    await renderApp(path, { repositories: createTestRepositories({ latencyMs: 500 }) })
    // Every loading label starts with "Loading", e.g. "Loading your spots".
    expect(screen.getByText(/^Loading/)).toBeInTheDocument()
  })

  it('shows an error with a Try again button when loading fails, and recovers', async () => {
    const repositories = createTestRepositories()
    repositories.dev?.setSimulateErrors(true)
    const user = newUser()
    await renderApp(path, { repositories })

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: 'Try again' })

    repositories.dev?.setSimulateErrors(false)
    await user.click(retry)
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('app-level states', () => {
  it('shows the loading fallback, not a blank page, while the first screen loads', async () => {
    // renderApp waits for the first screen; render without waiting to catch the fallback.
    const { render } = await import('@testing-library/react')
    const { createMemoryRouter, RouterProvider } = await import('react-router')
    const { AppProviders } = await import('@/app/providers')
    const { routes } = await import('@/app/routes')
    const router = createMemoryRouter(routes, { initialEntries: ['/plan'] })
    render(
      <AppProviders repositories={createTestRepositories()}>
        <RouterProvider router={router} />
      </AppProviders>,
    )
    expect(screen.getByText('Loading')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plan a Night Out' }),
    ).toBeInTheDocument()
  })
})
