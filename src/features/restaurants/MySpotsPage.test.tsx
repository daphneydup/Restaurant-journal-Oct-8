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

const cards = () =>
  within(screen.getByRole('main'))
    .getAllByRole('listitem')
    .filter((li) => li.querySelector('h2'))
const cardNames = () => cards().map((li) => within(li).getByRole('heading').textContent)

async function openSpots(path = '/') {
  const user = newUser()
  const utils = await renderApp(path, { repositories: repos })
  // Ready once the data has loaded (the Filters button is disabled until then).
  await waitFor(() => expect(screen.getByRole('button', { name: /^Filters/ })).toBeEnabled())
  return { user, ...utils }
}

describe('My Spots: list', () => {
  it('shows a loading state, then every spot, most recently visited first', async () => {
    await renderApp('/', { repositories: createTestRepositories({ latencyMs: 500 }) })
    expect(screen.getByText('Loading your spots')).toBeInTheDocument()

    await screen.findByRole('heading', { name: 'Ember & Orchard' })
    const names = cardNames()
    expect(names).toHaveLength(10)
    expect(names[0]).toBe('Noodle & Nori') // visited 3 days ago
    expect(names.at(-1)).toBe('Lantern Alley') // never visited
    expect(screen.getByText('10 spots')).toBeInTheDocument()
  })

  it('summarizes a spot: place, price, diet fit, go-back flag and last visit', async () => {
    await openSpots()
    const ember = cards().find((li) =>
      within(li).queryByRole('heading', { name: 'Ember & Orchard' }),
    )!

    expect(ember).toHaveTextContent('Uptown')
    expect(within(ember).getByText(/\$\$\$/)).toBeInTheDocument()
    expect(within(ember).getByText('Wood-fired American', { exact: false })).toBeInTheDocument()
    expect(within(ember).getByText('Go back')).toBeInTheDocument()
    expect(ember).toHaveTextContent('Last visited 1 week ago · 3 visits')

    const fit = within(ember).getByRole('list', { name: 'Diet fit' })
    expect(fit).toHaveTextContent('Vegan')
    expect(fit).toHaveTextContent('4.3') // (5 + 4 + 4) / 3
    expect(fit).toHaveTextContent('Steak')
    expect(fit).toHaveTextContent('4.7')
    expect(fit).toHaveTextContent('Gluten-free')
  })

  it('handles a spot that has never been visited', async () => {
    await openSpots()
    const lantern = cards().find((li) =>
      within(li).queryByRole('heading', { name: 'Lantern Alley' }),
    )!
    expect(lantern).toHaveTextContent('Not visited yet')
    expect(lantern).toHaveTextContent('No diet ratings yet')
  })

  it('makes each card a link to its detail page', async () => {
    const { user, router } = await openSpots()
    await user.click(screen.getByRole('link', { name: 'Little Fig Kitchen' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/spots/r-fig'))
  })
})

describe('My Spots: search', () => {
  it('filters by name as you type and keeps the query in the URL', async () => {
    const { user, router } = await openSpots()
    await user.type(screen.getByRole('searchbox', { name: 'Search by name' }), 'sprout')

    expect(cardNames()).toEqual(['Smokestack Sprout'])
    expect(screen.getByText('Showing 1 of 10 spots')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?q=sprout')
  })

  it('shows a helpful empty state when nothing matches, and can reset', async () => {
    const { user } = await openSpots()
    await user.type(screen.getByRole('searchbox', { name: 'Search by name' }), 'zzzz')

    expect(screen.getByRole('heading', { name: 'No spots match' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    expect(cardNames()).toHaveLength(10)
  })

  it('clears with the clear button', async () => {
    const { user } = await openSpots()
    await user.type(screen.getByRole('searchbox', { name: 'Search by name' }), 'fig')
    await user.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(cardNames()).toHaveLength(10)
    expect(screen.getByRole('searchbox', { name: 'Search by name' })).toHaveValue('')
  })

  it('starts from the URL (so a filtered view survives refresh)', async () => {
    await openSpots('/?q=ember')
    expect(cardNames()).toEqual(['Ember & Orchard'])
    expect(screen.getByRole('searchbox', { name: 'Search by name' })).toHaveValue('ember')
  })
})

describe('My Spots: filters', () => {
  async function openFilters() {
    const ctx = await openSpots()
    await ctx.user.click(screen.getByRole('button', { name: /^Filters/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Filters' })
    return { ...ctx, dialog }
  }

  it('filters by diet fit: spots must work for every chosen diet', async () => {
    const { user, dialog } = await openFilters()
    await user.click(within(dialog).getByRole('button', { name: 'Vegan' }))
    await user.click(within(dialog).getByRole('button', { name: 'Steak' }))

    expect(within(dialog).getByRole('button', { name: 'Show 4 spots' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Show 4 spots' }))

    expect(cardNames().sort()).toEqual([
      'Ember & Orchard',
      'Marigold Social',
      'Smokestack Sprout',
      'The Copper Table',
    ])
    expect(screen.getByRole('button', { name: /Filters.*2 active/ })).toBeInTheDocument()
  })

  it('filters by price tier', async () => {
    const { user, dialog } = await openFilters()
    await user.click(within(dialog).getByRole('button', { name: '$, budget' }))
    await user.click(within(dialog).getByRole('button', { name: 'Show 2 spots' }))
    expect(cardNames().sort()).toEqual(['Noodle & Nori', 'Smokestack Sprout'])
  })

  it('filters by neighborhood, and a second tap clears it', async () => {
    const { user, dialog } = await openFilters()
    const chip = within(dialog).getByRole('button', { name: 'Bishop Arts' })
    await user.click(chip)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(within(dialog).getByRole('button', { name: 'Show 2 spots' })).toBeInTheDocument()
    await user.click(chip)
    expect(within(dialog).getByRole('button', { name: 'Show 10 spots' })).toBeInTheDocument()
  })

  it('filters to the Go-Back list', async () => {
    const { user, dialog } = await openFilters()
    await user.click(within(dialog).getByRole('switch', { name: /Only my Go-Back list/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Show 5 spots' }))
    expect(cardNames()).toHaveLength(5)
    for (const li of cards()) expect(within(li).getByText('Go back')).toBeInTheDocument()
  })

  it('keeps the search text when filters are cleared, and clears them all', async () => {
    const { user } = await openSpots('/?q=a&price=1&goback=1')
    await user.click(screen.getByRole('button', { name: /^Filters/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Filters' })
    await user.click(within(dialog).getByRole('button', { name: 'Clear filters' }))
    expect(within(dialog).getByRole('button', { name: 'Clear filters' })).toBeDisabled()
    expect(screen.getByRole('searchbox', { name: 'Search by name' })).toHaveValue('a')
  })

  it('closes with Escape, the Close button, or Done', async () => {
    const { user } = await openFilters()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('applies filters from the URL', async () => {
    await openSpots('/?diet=vegan&price=1')
    // The two budget spots that work for vegans.
    expect(cardNames().sort()).toEqual(['Noodle & Nori', 'Smokestack Sprout'])
  })
})

describe('My Spots: empty and error states', () => {
  it('invites you to log a first visit when there are no spots', async () => {
    for (const r of await repos.restaurants.list()) await repos.restaurants.remove(r.id)
    await renderApp('/', { repositories: repos })

    expect(await screen.findByRole('heading', { name: 'No spots yet' })).toBeInTheDocument()
    // One in the page header, one as the empty state's call to action.
    const links = screen.getAllByRole('link', { name: 'Log a visit' })
    expect(links).toHaveLength(2)
    for (const link of links) expect(link).toHaveAttribute('href', '/log')
  })

  it('shows an error with retry when loading fails, then recovers', async () => {
    repos.dev?.setSimulateErrors(true)
    const user = newUser()
    await renderApp('/', { repositories: repos })

    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load your spots')
    repos.dev?.setSimulateErrors(false)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Ember & Orchard' })).toBeInTheDocument()
  })
})
