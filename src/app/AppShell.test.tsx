import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/renderWithRouter'

describe('App shell and routing', () => {
  it('renders My Spots at the root with both navigation landmarks', () => {
    renderApp('/')
    expect(screen.getByRole('heading', { level: 1, name: 'My Spots' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary, mobile' })).toBeInTheDocument()
  })

  it('offers every top-level destination in the mobile tab bar', () => {
    renderApp('/')
    const tabBar = screen.getByRole('navigation', { name: 'Primary, mobile' })
    for (const name of ['My Spots', 'Go Back', 'Log a Visit', 'Plan a Night', 'Profile']) {
      expect(within(tabBar).getByRole('link', { name })).toBeInTheDocument()
    }
  })

  it('marks the current page with aria-current and navigates on click', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const tabBar = screen.getByRole('navigation', { name: 'Primary, mobile' })
    expect(within(tabBar).getByRole('link', { name: 'My Spots' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    await user.click(within(tabBar).getByRole('link', { name: 'Go Back' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Go Back' })).toBeInTheDocument()
    expect(within(tabBar).getByRole('link', { name: 'Go Back' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it.each([
    ['/log', 'Log a Visit'],
    ['/plan', 'Plan a Night Out'],
    ['/share/restaurant/abc', 'Share'],
    ['/profile', 'Profile'],
  ])('routes %s to its page', (path, heading) => {
    renderApp(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', () => {
    renderApp('/nope')
    expect(screen.getByRole('heading', { name: /couldn’t find that page/i })).toBeInTheDocument()
  })

  it('provides a skip link to the main landmark', () => {
    renderApp('/')
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main')
  })
})
