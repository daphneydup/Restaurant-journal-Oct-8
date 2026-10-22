import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { RepositoryError, type Repositories } from '@/data'
import { createTestQueryClient, renderApp } from '@/test/renderWithRouter'
import { createTestRepositories, TEST_NOW } from '@/test/testRepositories'
import type { Gif } from '@/types'
import { GifField, type ChosenGif } from './GifField'

const deepGif = (id: string): Gif => ({
  id,
  title: `Title ${id}`,
  pageUrl: `https://giphy.com/gifs/title-${id}`,
  previewUrl: `https://media.giphy.com/${id}-s.gif`,
  url: `https://media.giphy.com/${id}.gif`,
  width: 100,
  height: 60,
})

function Harness({ initial }: { initial?: ChosenGif }) {
  const [value, setValue] = useState<ChosenGif | undefined>(initial)
  return (
    <>
      <GifField value={value} onChange={setValue} />
      <output data-testid="chosen">{value ? `${value.title}|${value.url}` : 'none'}</output>
    </>
  )
}

function mount(repositories: Repositories = createTestRepositories(), initial?: ChosenGif) {
  return render(
    <AppProviders repositories={repositories} queryClient={createTestQueryClient()}>
      <Harness {...(initial ? { initial } : {})} />
    </AppProviders>,
  )
}

let user: ReturnType<typeof userEvent.setup>
beforeEach(() => {
  user = userEvent.setup()
})
afterEach(() => vi.restoreAllMocks())

const open = async () => {
  await user.click(screen.getByRole('button', { name: /Add a GIF/ }))
  return screen.findByRole('dialog')
}

describe('GIF picker', () => {
  it('shows what is trending as soon as it opens', async () => {
    mount()
    const dialog = await open()
    expect(within(dialog).getByRole('heading', { name: 'Choose a GIF' })).toBeInTheDocument()
    const list = await within(dialog).findByRole('list', { name: 'GIF results' })
    expect(within(list).getAllByRole('button').length).toBeGreaterThanOrEqual(10)
    expect(within(dialog).getByText(/trending GIFs/)).toBeInTheDocument()
  })

  it('searches as you type, waiting for a pause rather than asking on every key', async () => {
    const repos = createTestRepositories()
    const search = vi.spyOn(repos.gifs, 'search')
    mount(repos)
    const dialog = await open()
    await within(dialog).findByRole('list', { name: 'GIF results' })
    const before = search.mock.calls.length

    await user.type(within(dialog).getByRole('searchbox', { name: 'Search GIFs' }), 'chef kiss')
    await waitFor(() =>
      expect(within(dialog).getByRole('list', { name: 'GIF results' }).children).toHaveLength(1),
    )
    expect(within(dialog).getByRole('button', { name: 'Chef’s kiss' })).toBeInTheDocument()
    // Nine keystrokes, but only the settled words were searched.
    expect(search.mock.calls.length - before).toBeLessThanOrEqual(2)
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ query: 'chef kiss' }))
  })

  it('says so when nothing matches', async () => {
    mount()
    const dialog = await open()
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search GIFs' }), 'zzzz')
    expect(await within(dialog).findByText(/No GIFs for “zzzz”/)).toBeInTheDocument()
  })

  it('shows a loading state while GIFs are on their way', async () => {
    mount(createTestRepositories({ latencyMs: 400 }))
    const dialog = await open()
    expect(within(dialog).getByText('Loading GIFs')).toBeInTheDocument()
    expect(await within(dialog).findByRole('list', { name: 'GIF results' })).toBeInTheDocument()
  })

  it('shows an error with a way to retry, then recovers', async () => {
    const repos = createTestRepositories()
    repos.dev?.setSimulateErrors(true)
    mount(repos)
    const dialog = await open()
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('We couldn’t load GIFs')

    repos.dev?.setSimulateErrors(false)
    await user.click(within(dialog).getByRole('button', { name: 'Try again' }))
    expect(await within(dialog).findByRole('list', { name: 'GIF results' })).toBeInTheDocument()
  })

  it('tells people when GIPHY is rate limiting, rather than blaming their connection', async () => {
    const repos = createTestRepositories()
    repos.gifs.search = () => Promise.reject(new RepositoryError('rate_limited', 'busy'))
    mount(repos)
    const dialog = await open()
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('GIPHY is busy')
  })

  it('loads more pages on request, and stops offering more at the end', async () => {
    const repos = createTestRepositories()
    const pages = [
      { gifs: [deepGif('a'), deepGif('b')], nextOffset: 2 },
      { gifs: [deepGif('c')], nextOffset: null },
    ]
    repos.gifs.search = vi.fn(({ offset = 0 } = {}) =>
      Promise.resolve(pages[offset === 0 ? 0 : 1]!),
    )
    mount(repos)
    const dialog = await open()
    expect(await within(dialog).findAllByRole('button', { name: /^Title/ })).toHaveLength(2)

    await user.click(within(dialog).getByRole('button', { name: 'More GIFs' }))
    await waitFor(() =>
      expect(within(dialog).getAllByRole('button', { name: /^Title/ })).toHaveLength(3),
    )
    expect(within(dialog).queryByRole('button', { name: 'More GIFs' })).not.toBeInTheDocument()
    expect(repos.gifs.search).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 2 }))
  })

  it('credits GIPHY when it is the source, and says "demo" when it is not', async () => {
    mount()
    let dialog = await open()
    expect(within(dialog).getByText(/Demo pictures/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: /GIPHY/ })).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Close' }))

    const live = { ...createTestRepositories(), kind: 'supabase' as const }
    mount(live)
    await user.click(screen.getAllByRole('button', { name: /Add a GIF/ })[1]!)
    dialog = (await screen.findAllByRole('dialog')).at(-1)!
    const link = await within(dialog).findByRole('link', { name: /GIPHY/ })
    expect(link).toHaveAttribute('href', 'https://giphy.com')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
})

describe('GifField', () => {
  it('chooses a GIF, shows it with its title as the alt text, and closes the picker', async () => {
    mount()
    expect(screen.getByTestId('chosen')).toHaveTextContent('none')
    const dialog = await open()
    await user.click(await within(dialog).findByRole('button', { name: 'Chef’s kiss' }))

    expect(screen.getByTestId('chosen').textContent).toMatch(/^Chef’s kiss\|data:image\/svg/)
    expect(screen.getByRole('img', { name: 'Chef’s kiss' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /^Add a GIF/ })).not.toBeInTheDocument()
  })

  it('removes the choice', async () => {
    mount(createTestRepositories(), { url: 'https://media.giphy.com/a.gif', title: 'Cheers' })
    expect(screen.getByRole('img', { name: 'Cheers' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remove GIF: Cheers' }))
    expect(screen.getByTestId('chosen')).toHaveTextContent('none')
    expect(screen.getByRole('button', { name: /Add a GIF/ })).toBeInTheDocument()
  })

  it('lets the person change their mind', async () => {
    mount(createTestRepositories(), { url: 'https://media.giphy.com/a.gif', title: 'Cheers' })
    await user.click(screen.getByRole('button', { name: 'Change GIF' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(await within(dialog).findByRole('button', { name: 'Yum' }))
    expect(screen.getByTestId('chosen').textContent).toMatch(/^Yum\|/)
  })

  it('starts the next search fresh each time it is opened', async () => {
    mount()
    let dialog = await open()
    await user.type(within(dialog).getByRole('searchbox', { name: 'Search GIFs' }), 'chef kiss')
    await user.click(await within(dialog).findByRole('button', { name: 'Chef’s kiss' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Change GIF' }))
    dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('searchbox', { name: 'Search GIFs' })).toHaveValue('')
  })
})

describe('GIFs on a visit', () => {
  it('saves the chosen GIF with the visit and shows it in the visit history', async () => {
    const repos = createTestRepositories()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TEST_NOW)
    await renderApp('/log?restaurantId=r-noodle', { repositories: repos })
    await screen.findByRole('heading', { name: 'Where & when' })

    await user.click(screen.getByRole('button', { name: /^More details/ }))
    await user.click(screen.getByRole('button', { name: /Add a GIF/ }))
    await user.click(await screen.findByRole('button', { name: 'Yum' }))
    for (const [lens, stars] of [
      ['Vegan options', 5],
      ['Steak / meat', 4],
    ] as const) {
      const group = screen.getByRole('group', { name: `Rating for ${lens}` })
      await user.click(within(group).getByRole('radio', { name: new RegExp(`^${stars} of 5`) }))
    }
    await user.click(screen.getByRole('button', { name: 'Save visit' }))

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Noodle & Nori' }),
    ).toBeInTheDocument()
    const [latest] = await repos.visits.listByRestaurant('r-noodle')
    expect(latest).toMatchObject({ gifTitle: 'Yum' })
    expect(latest!.gifUrl).toMatch(/^data:image\/svg/)
    const history = await screen.findByRole('heading', { level: 2, name: /Visit history/ })
    expect(history.parentElement).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Yum' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('saves nothing extra when no GIF is chosen', async () => {
    const repos = createTestRepositories()
    await renderApp('/log?restaurantId=r-noodle', { repositories: repos })
    await screen.findByRole('heading', { name: 'Where & when' })
    for (const [lens, stars] of [
      ['Vegan options', 5],
      ['Steak / meat', 4],
    ] as const) {
      const group = screen.getByRole('group', { name: `Rating for ${lens}` })
      await user.click(within(group).getByRole('radio', { name: new RegExp(`^${stars} of 5`) }))
    }
    await user.click(screen.getByRole('button', { name: 'Save visit' }))
    await screen.findByRole('heading', { level: 1, name: 'Noodle & Nori' })
    const [latest] = await repos.visits.listByRestaurant('r-noodle')
    expect('gifUrl' in latest!).toBe(false)
    expect('gifTitle' in latest!).toBe(false)
  })

  it('shows a GIF saved on an earlier visit', async () => {
    const repos = createTestRepositories()
    const [visit] = await repos.visits.listByRestaurant('r-ember')
    await repos.visits.update(visit!.id, {
      gifUrl: 'https://media.giphy.com/a.gif',
      gifTitle: 'Cheers',
    })
    await renderApp('/spots/r-ember', { repositories: repos })
    const img = await screen.findByRole('img', { name: 'Cheers' })
    expect(img).toHaveAttribute('src', 'https://media.giphy.com/a.gif')
    expect(img).toHaveAttribute('loading', 'lazy')
  })
})

describe('GIFs in share posts', () => {
  async function openShare(repos: Repositories) {
    await renderApp('/share/restaurant/r-ember', { repositories: repos })
    const panel = await screen.findByRole('region', { name: 'Post it' })
    return panel
  }
  const caption = (panel: HTMLElement) =>
    new URL(within(panel).getByRole('link', { name: /^X/ }).getAttribute('href')!).searchParams.get(
      'text',
    )!

  it('adds the GIF’s GIPHY link to the caption of every link, and drops it when removed', async () => {
    const repos = createTestRepositories()
    repos.gifs.search = () => Promise.resolve({ gifs: [deepGif('a')], nextOffset: null })
    const panel = await openShare(repos)
    expect(caption(panel)).not.toContain('giphy.com')

    await user.click(within(panel).getByRole('button', { name: /Add a GIF/ }))
    await user.click(await screen.findByRole('button', { name: 'Title a' }))
    await waitFor(() => expect(caption(panel)).toMatch(/ https:\/\/giphy\.com\/gifs\/title-a$/))

    const wa = new URL(
      within(panel)
        .getByRole('link', { name: /^WhatsApp/ })
        .getAttribute('href')!,
    )
    expect(wa.searchParams.get('text')).toContain('https://giphy.com/gifs/title-a')
    const mail = new URL(
      within(panel)
        .getByRole('link', { name: /^Email/ })
        .getAttribute('href')!,
    )
    expect(mail.searchParams.get('body')).toContain('https://giphy.com/gifs/title-a')

    await user.click(within(panel).getByRole('button', { name: 'Remove GIF: Title a' }))
    expect(caption(panel)).not.toContain('giphy.com')
  })

  it('does not add a pointless link for the demo pictures', async () => {
    const panel = await openShare(createTestRepositories())
    await user.click(within(panel).getByRole('button', { name: /Add a GIF/ }))
    await user.click(await screen.findByRole('button', { name: 'Cheers' }))
    expect(within(panel).getByRole('img', { name: 'Cheers' })).toBeInTheDocument()
    expect(caption(panel)).not.toContain('giphy.com')
  })

  it('keeps the caption within what X allows, even with a GIF link', async () => {
    const repos = createTestRepositories()
    repos.gifs.search = () => Promise.resolve({ gifs: [deepGif('a')], nextOffset: null })
    const panel = await openShare(repos)
    await user.click(within(panel).getByRole('button', { name: /Add a GIF/ }))
    await user.click(await screen.findByRole('button', { name: 'Title a' }))
    await waitFor(() => expect(caption(panel)).toContain('giphy.com'))
    // X counts every link as 23 characters: caption + GIF link + invite link.
    const x = new URL(within(panel).getByRole('link', { name: /^X/ }).getAttribute('href')!)
    const text = x.searchParams.get('text')!.replace(/https?:\/\/\S+/g, 'x'.repeat(23))
    expect(text.length + 1 + 23).toBeLessThanOrEqual(280)
  })

  it('shares the GIF link through the native sheet too', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    const repos = createTestRepositories()
    repos.gifs.search = () => Promise.resolve({ gifs: [deepGif('a')], nextOffset: null })
    const panel = await openShare(repos)
    await user.click(within(panel).getByRole('button', { name: /Add a GIF/ }))
    await user.click(await screen.findByRole('button', { name: 'Title a' }))
    await waitFor(() => expect(within(panel).getByRole('button', { name: /Share…/ })).toBeEnabled())
    await user.click(within(panel).getByRole('button', { name: /Share…/ }))
    expect(share.mock.calls[0]![0].text).toMatch(/https:\/\/giphy\.com\/gifs\/title-a$/)
    Reflect.deleteProperty(navigator, 'share')
    Reflect.deleteProperty(navigator, 'canShare')
  })
})
