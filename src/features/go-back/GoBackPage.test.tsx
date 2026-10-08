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

const names = () =>
  within(screen.getByRole('main'))
    .getAllByRole('heading', { level: 2 })
    .map((h) => h.textContent)

describe('Go-Back list', () => {
  it('shows a loading state, then the spots you want to revisit, longest wait first', async () => {
    await renderApp('/go-back', { repositories: createTestRepositories({ latencyMs: 150 }) })
    expect(screen.getByText('Loading your Go-Back list')).toBeInTheDocument()

    await screen.findByRole('heading', { level: 2, name: 'The Copper Table' })
    expect(names()).toEqual([
      'The Copper Table',
      'Saffron & Salt',
      'Lantern Alley',
      'Ember & Orchard',
      'Little Fig Kitchen',
    ])
  })

  it('uses gentle wording for how long it has been', async () => {
    await renderApp('/go-back', { repositories: repos })
    const card = async (name: string) =>
      (await screen.findByRole('heading', { level: 2, name })).closest('li')!

    expect(await card('The Copper Table')).toHaveTextContent('You haven’t been in 7 months.')
    expect(await card('Saffron & Salt')).toHaveTextContent('You haven’t been in 2 months.')
    expect(await card('Ember & Orchard')).toHaveTextContent('You haven’t been in 1 week.')
    expect(await card('Little Fig Kitchen')).toHaveTextContent('You haven’t been in 1 week.')
    expect(await card('Lantern Alley')).toHaveTextContent(
      'You haven’t been yet. Saved 2 weeks ago.',
    )
  })

  it('shows the note you left and how each diet fared', async () => {
    await renderApp('/go-back', { repositories: repos })
    const copper = (
      await screen.findByRole('heading', { level: 2, name: 'The Copper Table' })
    ).closest('li')!
    expect(copper).toHaveTextContent('Birthday dinner?')
    expect(within(copper).getByRole('list', { name: 'Diet fit' })).toHaveTextContent('Vegan')
    expect(copper).toHaveTextContent('Uptown')
  })

  it('offers to log a visit, prefilled for that spot', async () => {
    await renderApp('/go-back', { repositories: repos })
    const copper = (
      await screen.findByRole('heading', { level: 2, name: 'The Copper Table' })
    ).closest('li')!
    expect(within(copper).getByRole('link', { name: 'Log a visit' })).toHaveAttribute(
      'href',
      '/log?restaurantId=r-copper',
    )
  })

  it('removes a spot from the list without deleting the spot', async () => {
    const user = newUser()
    await renderApp('/go-back', { repositories: repos })
    await screen.findByRole('heading', { level: 2, name: 'The Copper Table' })

    await user.click(
      screen.getByRole('button', { name: 'Remove The Copper Table from Go-Back list' }),
    )
    expect(
      await screen.findByText('The Copper Table removed from your Go-Back list'),
    ).toBeInTheDocument()
    await waitFor(() => expect(names()).not.toContain('The Copper Table'))
    expect(await repos.restaurants.getById('r-copper')).not.toBeNull()
    expect(await repos.goBack.getByRestaurantId('r-copper')).toBeNull()
  })

  it('moves a spot down the list once you log a visit there', async () => {
    await repos.visits.logVisit({
      restaurant: { mode: 'existing', restaurantId: 'r-copper' },
      visit: {
        date: '2026-10-07',
        ratings: [{ lensId: 'vegan', rating: 5 }],
        workedForEveryone: 'yes',
        priceTier: 4,
        companions: [],
        photoUrls: [],
      },
      dishes: [],
      addToGoBack: false,
    })
    await renderApp('/go-back', { repositories: repos })
    await screen.findByRole('heading', { level: 2, name: 'Saffron & Salt' })
    expect(names()[0]).toBe('Saffron & Salt')
    const copper = screen
      .getByRole('heading', { level: 2, name: 'The Copper Table' })
      .closest('li')!
    expect(copper).toHaveTextContent('You were there this week.')
  })

  it('invites you to flag spots when the list is empty', async () => {
    for (const entry of await repos.goBack.list()) await repos.goBack.remove(entry.id)
    await renderApp('/go-back', { repositories: repos })
    expect(
      await screen.findByRole('heading', { name: 'Nothing to revisit yet' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse my spots' })).toHaveAttribute('href', '/')
  })

  it('shows an error with retry, then recovers', async () => {
    repos.dev?.setSimulateErrors(true)
    const user = newUser()
    await renderApp('/go-back', { repositories: repos })
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load your Go-Back list')

    repos.dev?.setSimulateErrors(false)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'The Copper Table' }),
    ).toBeInTheDocument()
  })

  it('tells you when removing fails and keeps the spot', async () => {
    const user = newUser()
    await renderApp('/go-back', { repositories: repos })
    await screen.findByRole('heading', { level: 2, name: 'The Copper Table' })
    repos.dev?.setSimulateErrors(true)
    await user.click(
      screen.getByRole('button', { name: 'Remove The Copper Table from Go-Back list' }),
    )
    expect(await screen.findByText(/couldn’t update your list/i)).toBeInTheDocument()
    repos.dev?.setSimulateErrors(false)
    expect(await repos.goBack.getByRestaurantId('r-copper')).not.toBeNull()
  })
})
