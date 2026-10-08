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

async function openPlan(path = '/plan') {
  const user = newUser()
  const utils = await renderApp(path, { repositories: repos })
  await screen.findByRole('heading', {
    level: 2,
    name: /Your shortlist|Log a few visits first|Pick who’s coming/,
  })
  return { user, ...utils }
}

/** Names in the ranked list only (not the "worth a closer look" section nested beside it). */
const rankedNames = () => {
  const ranked = screen.getByRole('region', { name: 'Your shortlist' }).querySelector('ol')
  return within(ranked as HTMLElement)
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent?.replace(/^Number \d+: /, ''))
}

describe('Plan a Night Out', () => {
  it('shows a loading state, then starts from the profile’s diets (vegan + steak)', async () => {
    await renderApp('/plan', { repositories: createTestRepositories({ latencyMs: 150 }) })
    expect(screen.getByText('Loading your spots')).toBeInTheDocument()

    await screen.findByRole('heading', { level: 2, name: 'Your shortlist' })
    expect(screen.getByRole('button', { name: 'Vegan' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Steak' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Gluten-free' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('ranks the spots that work for everyone, best first', async () => {
    await openPlan()
    expect(rankedNames()).toEqual([
      'The Copper Table',
      'Ember & Orchard',
      'Smokestack Sprout',
      'Marigold Social',
    ])
    expect(screen.getByText('4 spots work for Vegan and Steak, best first.')).toBeInTheDocument()
  })

  it('explains each match: diet fit, how often it worked, last visit and go-back flag', async () => {
    await openPlan()
    const ember = screen.getByRole('heading', { level: 3, name: /Ember & Orchard/ }).closest('li')!
    expect(within(ember).getByRole('list', { name: 'Diet fit' })).toHaveTextContent('Vegan')
    expect(ember).toHaveTextContent('4.3')
    expect(ember).toHaveTextContent('4.7')
    expect(ember).toHaveTextContent('Worked for everyone in 3 of 3 visits')
    expect(ember).toHaveTextContent('last visited 1 week ago')
    expect(within(ember).getByText('Go back')).toBeInTheDocument()
  })

  it('links each result to the spot', async () => {
    const { user, router } = await openPlan()
    await user.click(screen.getByRole('link', { name: /Smokestack Sprout/ }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/spots/r-sprout'))
  })

  it('narrows the shortlist when the budget changes, and keeps it in the URL', async () => {
    const { user, router } = await openPlan()
    await user.click(screen.getByRole('radio', { name: /^\$\$ \(moderate\)/ }))

    expect(rankedNames()).toEqual(['Smokestack Sprout', 'Marigold Social'])
    expect(router.state.location.search).toBe('?diets=vegan%2Csteak&budget=2')
  })

  it('updates as diets are added, flagging spots that still need ratings', async () => {
    const { user } = await openPlan()
    await user.click(screen.getByRole('button', { name: 'Gluten-free' }))

    expect(rankedNames()).toContain('The Copper Table')
    expect(rankedNames()).not.toContain('Marigold Social')
    const needs = screen.getByRole('region', { name: 'Worth a closer look' })
    expect(within(needs).getByText('Marigold Social')).toBeInTheDocument()
    expect(needs).toHaveTextContent('Never rated for Gluten-free.')
    expect(within(needs).getAllByRole('link', { name: 'Log a visit' })[0]).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/log\?restaurantId=/),
    )
  })

  it('removing a diet widens the shortlist', async () => {
    const { user } = await openPlan()
    await user.click(screen.getByRole('button', { name: 'Steak' }))
    expect(screen.getByText(/spots work for Vegan, best first/)).toBeInTheDocument()
    expect(rankedNames()).toContain('Saffron & Salt')
  })

  it('starts from the URL', async () => {
    await openPlan('/plan?diets=vegetarian&budget=2')
    expect(screen.getByRole('button', { name: 'Vegetarian' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Vegan' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('radio', { name: /^\$\$ \(moderate\)/ })).toBeChecked()
    // Marigold and Fig both average 5 for vegetarian; Marigold worked for everyone more often.
    expect(rankedNames()).toEqual(['Marigold Social', 'Little Fig Kitchen', 'Basil & Bone'])
  })

  it('asks who’s coming when no diet is chosen', async () => {
    const { user } = await openPlan()
    await user.click(screen.getByRole('button', { name: 'Vegan' }))
    await user.click(screen.getByRole('button', { name: 'Steak' }))
    expect(screen.getByRole('heading', { name: 'Pick who’s coming' })).toBeInTheDocument()
  })

  it('says so when nothing fits, and suggests what to do', async () => {
    const { user } = await openPlan()
    await user.click(screen.getByRole('button', { name: 'Dairy-free' }))
    await user.click(screen.getByRole('radio', { name: /^\$ \(budget\)/ }))

    expect(screen.getByRole('heading', { name: 'Nothing fits yet' })).toBeInTheDocument()
    expect(
      screen.getByText(/No logged spots work for Vegan, Steak and Dairy-free within this budget/),
    ).toBeInTheDocument()
  })

  it('invites you to log visits when you have no spots', async () => {
    for (const r of await repos.restaurants.list()) await repos.restaurants.remove(r.id)
    await openPlan()
    expect(screen.getByRole('heading', { name: 'Log a few visits first' })).toBeInTheDocument()
  })

  it('shows an error with retry, then recovers', async () => {
    repos.dev?.setSimulateErrors(true)
    const user = newUser()
    await renderApp('/plan', { repositories: repos })
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load your spots')

    repos.dev?.setSimulateErrors(false)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Your shortlist' })).toBeInTheDocument(),
    )
  })

  it('reflects a newly logged visit', async () => {
    // Noodle & Nori's steak average is 2. A new 5 lifts it to (2 + 5) / 2 = 3.5, exactly the bar.
    await repos.visits.logVisit({
      restaurant: { mode: 'existing', restaurantId: 'r-noodle' },
      visit: {
        date: '2026-10-08',
        ratings: [
          { lensId: 'vegan', rating: 5 },
          { lensId: 'steak', rating: 5 },
        ],
        workedForEveryone: 'yes',
        priceTier: 1,
        companions: [],
        photoUrls: [],
      },
      dishes: [],
      addToGoBack: false,
    })
    await openPlan()
    // Ties Marigold Social on the weakest diet (3.5) but worked for everyone less often.
    expect(rankedNames()).toEqual([
      'The Copper Table',
      'Ember & Orchard',
      'Smokestack Sprout',
      'Marigold Social',
      'Noodle & Nori',
    ])
  })
})
