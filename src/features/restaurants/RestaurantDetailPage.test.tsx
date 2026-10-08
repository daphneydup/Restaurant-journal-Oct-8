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

async function openSpot(id: string, heading: string) {
  const user = newUser()
  const utils = renderApp(`/spots/${id}`, { repositories: repos })
  await screen.findByRole('heading', { level: 1, name: heading })
  return { user, ...utils }
}

const section = (title: string | RegExp) =>
  screen.getByRole('heading', { level: 2, name: title }).closest('div')!

describe('Restaurant detail: overview', () => {
  it('shows a loading state, then the restaurant', async () => {
    renderApp('/spots/r-ember', { repositories: repos })
    expect(screen.getByText('Loading restaurant')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ember & Orchard' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Uptown · $$$ · Wood-fired American')).toBeInTheDocument()
  })

  it('links to logging another visit (prefilled) and to sharing', async () => {
    await openSpot('r-ember', 'Ember & Orchard')
    expect(screen.getByRole('link', { name: 'Log a visit' })).toHaveAttribute(
      'href',
      '/log?restaurantId=r-ember',
    )
    expect(screen.getByRole('link', { name: 'Share' })).toHaveAttribute(
      'href',
      '/share/restaurant/r-ember',
    )
  })

  it('sets the page title for screen-reader users', async () => {
    await openSpot('r-ember', 'Ember & Orchard')
    expect(document.title).toBe('Ember & Orchard · Table for Everyone')
  })
})

describe('Restaurant detail: diet breakdown', () => {
  it('shows the average and visit count for each diet that was rated', async () => {
    await openSpot('r-ember', 'Ember & Orchard')
    const breakdown = section('How each diet fared')

    const vegan = within(breakdown).getByText('Vegan options').closest('li')!
    expect(vegan).toHaveTextContent('4.3 / 5 · 3 visits')
    expect(within(breakdown).getByText('Steak / meat').closest('li')).toHaveTextContent(
      '4.7 / 5 · 3 visits',
    )
    expect(within(breakdown).getByText('Gluten-free').closest('li')).toHaveTextContent(
      '4 / 5 · 1 visit',
    )
    expect(within(breakdown).queryByText('Dairy-free')).not.toBeInTheDocument()
  })

  it('tallies how often it worked for everyone', async () => {
    await openSpot('r-cinder', 'Cinder House')
    const breakdown = section('How each diet fared')
    expect(breakdown).toHaveTextContent('Worked for everyone in 0 of 2 visits')
    expect(breakdown).toHaveTextContent('0 yes · 1 maybe · 1 no')
  })

  it('reports whether it was worth the price when that was answered', async () => {
    await openSpot('r-ember', 'Ember & Orchard')
    expect(section('How each diet fared')).toHaveTextContent('Worth the price in 2 of 2 answers')
  })

  it('explains an empty history instead of showing blank bars', async () => {
    await openSpot('r-lantern', 'Lantern Alley')
    expect(
      screen.getByText(/No visits yet. Log one to see how each diet fared/),
    ).toBeInTheDocument()
    expect(screen.getByText('No visits logged yet.')).toBeInTheDocument()
  })
})

describe('Restaurant detail: dishes', () => {
  it('splits dishes into order-again and skip, with the diets they suit', async () => {
    await openSpot('r-ember', 'Ember & Orchard')
    const dishes = section('Dishes')
    const again = within(dishes).getByRole('heading', { name: 'Order again' }).parentElement!
    const skip = within(dishes).getByRole('heading', { name: 'Skip' }).parentElement!

    expect(again).toHaveTextContent('Charred cauliflower steak')
    expect(again).toHaveTextContent('12oz dry-aged ribeye')
    expect(skip).toHaveTextContent('Burnt-honey flatbread')
    expect(within(again).getByText('Works for Vegan, Vegetarian, Gluten-free')).toBeInTheDocument()
  })

  it('lets you share a single dish', async () => {
    await openSpot('r-ember', 'Ember & Orchard')
    expect(screen.getByRole('link', { name: 'Share Charred cauliflower steak' })).toHaveAttribute(
      'href',
      '/share/dish/d-1',
    )
  })

  it('says so when there are no dishes yet', async () => {
    await openSpot('r-lantern', 'Lantern Alley')
    expect(screen.getByText('No favorites saved yet.')).toBeInTheDocument()
    expect(screen.getByText('Nothing to skip so far.')).toBeInTheDocument()
  })
})

describe('Restaurant detail: visit history', () => {
  it('lists visits newest first with the verdict, ratings, companions and notes', async () => {
    await openSpot('r-ember', 'Ember & Orchard')
    const history = section(/Visit history/)
    expect(screen.getByRole('heading', { level: 2, name: 'Visit history (3)' })).toBeInTheDocument()

    const items = within(history).getAllByRole('heading', { level: 3 })
    expect(items).toHaveLength(3)
    const first = items[0]!.closest('li')!
    expect(first).toHaveTextContent('Worked for everyone')
    expect(first).toHaveTextContent('Vegan 5/5')
    expect(first).toHaveTextContent('Steak 5/5')
    expect(first).toHaveTextContent('With Maya, Dev')
    expect(first).toHaveTextContent('Nobody fought over the menu')
    expect(first).toHaveTextContent('1 week ago')
  })

  it('confirms before deleting a visit, then removes it and its dishes', async () => {
    const { user } = await openSpot('r-ember', 'Ember & Orchard')
    const before = await repos.visits.listByRestaurant('r-ember')
    expect(before).toHaveLength(3)

    await user.click(screen.getAllByRole('button', { name: /^Delete visit from/ })[0]!)
    const dialog = await screen.findByRole('dialog', { name: 'Delete this visit?' })
    expect(dialog).toHaveTextContent('can’t be undone')
    await user.click(within(dialog).getByRole('button', { name: 'Delete visit' }))

    expect(await screen.findByText('Visit deleted')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Visit history (2)' }),
    ).toBeInTheDocument()
    expect(await repos.visits.getById('v-ember-1')).toBeNull()
    // Dishes that were logged on that visit went with it.
    expect(
      (await repos.dishes.listByRestaurant('r-ember')).some((d) => d.visitId === 'v-ember-1'),
    ).toBe(false)
    expect(screen.queryByText('Charred cauliflower steak')).not.toBeInTheDocument()
  })

  it('keeps the visit when you cancel', async () => {
    const { user } = await openSpot('r-ember', 'Ember & Orchard')
    await user.click(screen.getAllByRole('button', { name: /^Delete visit from/ })[0]!)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await repos.visits.listByRestaurant('r-ember')).toHaveLength(3)
  })

  it('tells you when a delete fails and keeps the visit', async () => {
    const { user } = await openSpot('r-ember', 'Ember & Orchard')
    await user.click(screen.getAllByRole('button', { name: /^Delete visit from/ })[0]!)
    const dialog = await screen.findByRole('dialog')
    repos.dev?.setSimulateErrors(true)
    await user.click(within(dialog).getByRole('button', { name: 'Delete visit' }))

    expect(await screen.findByText(/couldn’t delete that visit/i)).toBeInTheDocument()
    repos.dev?.setSimulateErrors(false)
    expect(await repos.visits.listByRestaurant('r-ember')).toHaveLength(3)
  })
})

describe('Restaurant detail: Go back toggle', () => {
  it('reflects whether the spot is on the list', async () => {
    await openSpot('r-ember', 'Ember & Orchard')
    expect(await screen.findByRole('switch', { name: /Go back/ })).toBeChecked()
    expect(screen.getByText('On your list for 2 weeks.')).toBeInTheDocument()
  })

  it('adds a spot to the list', async () => {
    const { user } = await openSpot('r-noodle', 'Noodle & Nori')
    const toggle = await screen.findByRole('switch', { name: /Go back/ })
    await waitFor(() => expect(toggle).toBeEnabled())
    expect(toggle).not.toBeChecked()

    await user.click(toggle)
    expect(await screen.findByText('Added to your Go-Back list')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('switch', { name: /Go back/ })).toBeChecked())
    expect(await repos.goBack.getByRestaurantId('r-noodle')).not.toBeNull()
  })

  it('removes a spot from the list', async () => {
    const { user } = await openSpot('r-ember', 'Ember & Orchard')
    const toggle = await screen.findByRole('switch', { name: /Go back/ })
    await waitFor(() => expect(toggle).toBeEnabled())

    await user.click(toggle)
    expect(await screen.findByText('Removed from your Go-Back list')).toBeInTheDocument()
    expect(await repos.goBack.getByRestaurantId('r-ember')).toBeNull()
  })
})

describe('Restaurant detail: removing a spot', () => {
  it('confirms, then deletes the spot with its history and returns to My Spots', async () => {
    const { user, router } = await openSpot('r-fig', 'Little Fig Kitchen')
    await user.click(screen.getByRole('button', { name: 'Remove this spot' }))

    const dialog = await screen.findByRole('dialog', { name: 'Remove Little Fig Kitchen?' })
    expect(dialog).toHaveTextContent('2 visits')
    await user.click(within(dialog).getByRole('button', { name: 'Remove spot' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await screen.findByText('Little Fig Kitchen removed')).toBeInTheDocument()
    expect(await repos.restaurants.getById('r-fig')).toBeNull()
    expect(await repos.visits.listByRestaurant('r-fig')).toEqual([])
    expect(await repos.goBack.getByRestaurantId('r-fig')).toBeNull()
  })
})

describe('Restaurant detail: other states', () => {
  it('shows a friendly page for an unknown restaurant', async () => {
    renderApp('/spots/ghost', { repositories: repos })
    expect(
      await screen.findByRole('heading', { name: 'We couldn’t find that restaurant' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to My Spots' })).toHaveAttribute('href', '/')
  })

  it('shows an error with retry, then recovers', async () => {
    repos.dev?.setSimulateErrors(true)
    const user = newUser()
    renderApp('/spots/r-ember', { repositories: repos })

    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load this spot')
    repos.dev?.setSimulateErrors(false)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Ember & Orchard' }),
    ).toBeInTheDocument()
  })

  it('shows photos from visits when there are any', async () => {
    const [visit] = await repos.visits.listByRestaurant('r-ember')
    await repos.visits.update(visit!.id, { photoUrls: ['data:image/jpeg;base64,AAAA'] })
    await openSpot('r-ember', 'Ember & Orchard')
    expect(screen.getByRole('img', { name: 'Snapshot 1 from Ember & Orchard' })).toBeInTheDocument()
  })
})
