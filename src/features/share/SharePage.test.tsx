import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repositories } from '@/data'
import { freezeToday, newUser } from '@/test/helpers'
import { renderApp } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'

let repos: Repositories
const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

beforeEach(() => {
  freezeToday()
  repos = createTestRepositories()
})
afterEach(() => {
  vi.useRealTimers()
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

describe('Share: restaurant card', () => {
  it('shows a clean card with the diet fit, the verdict and the dishes to order', async () => {
    await renderApp('/share/restaurant/r-ember', { repositories: repos })
    const card = (
      await screen.findByRole('heading', { level: 2, name: 'Ember & Orchard' })
    ).closest('article')!

    expect(card).toHaveTextContent('Uptown')
    expect(card).toHaveTextContent('Wood-fired American')
    expect(card).toHaveTextContent('Vegan')
    expect(card).toHaveTextContent('Worked for everyone in 3 of 3 visits.')
    expect(card).toHaveTextContent('Charred cauliflower steak')
    expect(card).toHaveTextContent('12oz dry-aged ribeye')
    expect(card).not.toHaveTextContent('Burnt-honey flatbread') // a "skip" dish
    expect(card).toHaveTextContent('Recommended by Summer')
    expect(card).toHaveTextContent('Table for Everyone')
  })

  it('works for a spot with no visits', async () => {
    await renderApp('/share/restaurant/r-lantern', { repositories: repos })
    const card = (await screen.findByRole('heading', { level: 2, name: 'Lantern Alley' })).closest(
      'article',
    )!
    expect(card).toHaveTextContent('No diet ratings yet.')
  })

  it('links back to the spot and sets the page title', async () => {
    await renderApp('/share/restaurant/r-ember', { repositories: repos })
    await screen.findByRole('heading', { level: 2, name: 'Ember & Orchard' })
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/spots/r-ember')
    expect(document.title).toBe('Share Ember & Orchard · Table for Everyone')
  })
})

describe('Share: dish card', () => {
  it('shows the dish, its verdict, the restaurant and the diets it suits', async () => {
    await renderApp('/share/dish/d-1', { repositories: repos })
    const card = (
      await screen.findByRole('heading', { level: 2, name: 'Charred cauliflower steak' })
    ).closest('article')!

    expect(card).toHaveTextContent('Order again')
    expect(card).toHaveTextContent('at Ember & Orchard · Uptown')
    expect(within(card).getByText('Vegan')).toBeInTheDocument()
    expect(within(card).getByText('Gluten-free')).toBeInTheDocument()
    expect(card).toHaveTextContent('Recommended by Summer')
  })

  it('words a skipped dish differently', async () => {
    await renderApp('/share/dish/d-3', { repositories: repos })
    const card = (
      await screen.findByRole('heading', { level: 2, name: 'Burnt-honey flatbread' })
    ).closest('article')!
    expect(card).toHaveTextContent('Skip this one')
    expect(card).toHaveTextContent('Skipped by Summer')
  })

  it('shows the dish photo when there is one', async () => {
    await repos.dishes.update('d-1', { photoUrl: 'data:image/jpeg;base64,AAAA' })
    await renderApp('/share/dish/d-1', { repositories: repos })
    expect(
      await screen.findByRole('img', { name: 'Charred cauliflower steak at Ember & Orchard' }),
    ).toBeInTheDocument()
  })

  it('links back to the dish’s restaurant', async () => {
    await renderApp('/share/dish/d-1', { repositories: repos })
    await screen.findByRole('heading', { level: 2, name: 'Charred cauliflower steak' })
    expect(screen.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/spots/r-ember')
  })
})

describe('Share: copy link', () => {
  it('shows this card’s link and says it is a preview', async () => {
    await renderApp('/share/restaurant/r-ember', { repositories: repos })
    const input = await screen.findByRole('textbox', { name: 'Share link' })
    expect(input).toHaveValue(`${window.location.origin}/share/restaurant/r-ember`)
    expect(input).toHaveAttribute('readonly')
    expect(screen.getByText(/Preview only/)).toBeInTheDocument()
  })

  it('copies the link and confirms', async () => {
    const user = newUser() // user-event installs its own clipboard stub, so mock after it
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await renderApp('/share/dish/d-1', { repositories: repos })

    await user.click(await screen.findByRole('button', { name: 'Copy link' }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/share/dish/d-1`)
    expect(await screen.findByText('Link copied')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('tells you how to copy by hand if the browser refuses', async () => {
    const user = newUser()
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    document.execCommand = vi.fn().mockReturnValue(false)
    await renderApp('/share/restaurant/r-ember', { repositories: repos })

    await user.click(await screen.findByRole('button', { name: 'Copy link' }))
    expect(await screen.findByText(/Select the link and copy it/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Share link' })).toHaveFocus()
  })
})

describe('Share: other states', () => {
  it('shows a loading state first', async () => {
    await renderApp('/share/restaurant/r-ember', {
      repositories: createTestRepositories({ latencyMs: 500 }),
    })
    expect(screen.getByText('Loading share card')).toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Ember & Orchard' }),
    ).toBeInTheDocument()
  })

  it.each(['/share/restaurant/ghost', '/share/dish/ghost'])(
    'says the link does not work for %s',
    async (path) => {
      await renderApp(path, { repositories: repos })
      expect(
        await screen.findByRole('heading', { name: 'That share link doesn’t work' }),
      ).toBeInTheDocument()
    },
  )

  it('shows the not-found page for an unknown kind of share', async () => {
    await renderApp('/share/menu/abc', { repositories: repos })
    expect(
      await screen.findByRole('heading', { name: /couldn’t find that page/ }),
    ).toBeInTheDocument()
  })

  it('shows an error with retry, then recovers', async () => {
    repos.dev?.setSimulateErrors(true)
    const user = newUser()
    await renderApp('/share/restaurant/r-ember', { repositories: repos })
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load this share card')

    repos.dev?.setSimulateErrors(false)
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Ember & Orchard' }),
    ).toBeInTheDocument()
  })
})
