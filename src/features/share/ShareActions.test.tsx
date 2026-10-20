import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from '@/app/providers'
import { forgetReferral } from '@/lib/pendingReferral'
import type { ShareImageSpec } from '@/lib/shareImage'
import { createTestQueryClient, renderApp } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'
import { ShareActions } from './ShareActions'
import type { ShareContent } from './shareContent'

const spec: ShareImageSpec = {
  eyebrow: 'Recommended',
  title: 'Ember & Orchard',
  subtitle: 'Uptown',
  rows: [],
  footerRight: 'Recommended by Summer',
}
const content: ShareContent = {
  title: 'Ember & Orchard on Table for Everyone',
  text: 'Ember & Orchard in Uptown.',
  image: spec,
  fileName: 'ember-orchard.png',
}
const png = new Blob(['png'], { type: 'image/png' })

function wrap(children: ReactNode, repositories = createTestRepositories()) {
  return render(
    <AppProviders repositories={repositories} queryClient={createTestQueryClient()}>
      {children}
    </AppProviders>,
  )
}

function setShare(share?: unknown, canShare?: unknown) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })
}

let created: string[]
let revoked: string[]
beforeEach(() => {
  forgetReferral()
  created = []
  revoked = []
  URL.createObjectURL = () => {
    const url = `blob:preview-${created.length}`
    created.push(url)
    return url
  }
  URL.revokeObjectURL = (url: string) => void revoked.push(url)
})
afterEach(() => {
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
  vi.restoreAllMocks()
})

describe('ShareActions: the picture', () => {
  it('prepares the image, shows a preview, and offers to save it', async () => {
    let finish!: (blob: Blob) => void
    const renderImage = vi.fn(() => new Promise<Blob>((resolve) => (finish = resolve)))
    wrap(<ShareActions content={content} renderImage={renderImage} />)

    expect(screen.getByText('Preparing your image…')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save image/ })).not.toBeInTheDocument()
    expect(renderImage).toHaveBeenCalledWith(spec)

    await act(async () => finish(png))
    expect(
      await screen.findByRole('img', { name: 'Preview of the card you’ll share' }),
    ).toHaveAttribute('src', 'blob:preview-0')
    expect(screen.queryByText('Preparing your image…')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Save image/ })).toBeInTheDocument()
  })

  it('saves the image under the card’s file name', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const user = userEvent.setup()
    wrap(<ShareActions content={content} renderImage={() => Promise.resolve(png)} />)
    await user.click(await screen.findByRole('button', { name: /Save image/ }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('says so, and keeps the links, when the picture can’t be made', async () => {
    wrap(
      <ShareActions content={content} renderImage={() => Promise.reject(new Error('no canvas'))} />,
    )
    expect(await screen.findByText(/couldn’t make the picture on this device/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save image/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^X/ })).toBeInTheDocument()
  })

  it('draws nothing for a words-only share', () => {
    const renderImage = vi.fn()
    wrap(<ShareActions content={{ title: 'Join', text: 'Come along' }} renderImage={renderImage} />)
    expect(renderImage).not.toHaveBeenCalled()
    expect(screen.queryByText('Preparing your image…')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save image/ })).not.toBeInTheDocument()
  })

  it('draws once per distinct picture, not on every render', async () => {
    const renderImage = vi.fn(() => Promise.resolve(png))
    const { rerender } = wrap(<ShareActions content={content} renderImage={renderImage} />)
    await screen.findByRole('img')
    rerender(
      <AppProviders repositories={createTestRepositories()} queryClient={createTestQueryClient()}>
        <ShareActions content={{ ...content, image: { ...spec } }} renderImage={renderImage} />
      </AppProviders>,
    )
    expect(renderImage).toHaveBeenCalledTimes(1)
  })

  it('redraws when the card changes, and releases the old preview', async () => {
    const renderImage = vi.fn(() => Promise.resolve(png))
    const { rerender } = wrap(<ShareActions content={content} renderImage={renderImage} />)
    await screen.findByRole('img')
    rerender(
      <AppProviders repositories={createTestRepositories()} queryClient={createTestQueryClient()}>
        <ShareActions
          content={{ ...content, image: { ...spec, title: 'Another Place' } }}
          renderImage={renderImage}
        />
      </AppProviders>,
    )
    await waitFor(() => expect(renderImage).toHaveBeenCalledTimes(2))
    expect(revoked).toContain('blob:preview-0')
  })

  it('makes no preview, and leaks nothing, if the picture arrives after the panel is gone', async () => {
    let finish!: (blob: Blob) => void
    const { unmount } = wrap(
      <ShareActions content={content} renderImage={() => new Promise<Blob>((r) => (finish = r))} />,
    )
    unmount()
    await act(async () => finish(png))
    expect(created).toEqual([])
  })

  it('releases the preview when it goes away', async () => {
    const { unmount } = wrap(
      <ShareActions content={content} renderImage={() => Promise.resolve(png)} />,
    )
    await screen.findByRole('img')
    unmount()
    expect(revoked).toEqual(['blob:preview-0'])
  })
})

describe('ShareActions: the share sheet', () => {
  it('is not offered where the browser has no share sheet', async () => {
    wrap(<ShareActions content={content} renderImage={() => Promise.resolve(png)} />)
    await screen.findByRole('img')
    expect(screen.queryByRole('button', { name: /Share…/ })).not.toBeInTheDocument()
  })

  it('waits for the picture before it can be tapped, so the picture is always attached', async () => {
    setShare(vi.fn().mockResolvedValue(undefined), () => true)
    let finish!: (blob: Blob) => void
    wrap(
      <ShareActions content={content} renderImage={() => new Promise<Blob>((r) => (finish = r))} />,
    )
    expect(screen.getByRole('button', { name: /Share…/ })).toBeDisabled()
    await act(async () => finish(png))
    expect(screen.getByRole('button', { name: /Share…/ })).toBeEnabled()
  })

  it('shares the picture, caption and invite link, then thanks them', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShare(share, () => true)
    const user = userEvent.setup()
    const repos = createTestRepositories()
    const { code } = await repos.rewards.getReferral()
    wrap(<ShareActions content={content} renderImage={() => Promise.resolve(png)} />, repos)

    await screen.findByRole('img')
    await user.click(await screen.findByRole('button', { name: /Share…/ }))

    expect(share).toHaveBeenCalledTimes(1)
    const data = share.mock.calls[0]![0]
    expect(data).toMatchObject({
      title: content.title,
      text: content.text,
      url: `${window.location.origin}/join?ref=${code}`,
    })
    expect(data.files).toHaveLength(1)
    expect(data.files[0]).toMatchObject({ name: 'ember-orchard.png', type: 'image/png' })
    expect(await screen.findByText('Thanks for sharing')).toBeInTheDocument()
  })

  it('does nothing visible when the person closes the sheet', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')), () => true)
    const user = userEvent.setup()
    wrap(<ShareActions content={content} renderImage={() => Promise.resolve(png)} />)
    await user.click(await screen.findByRole('button', { name: /Share…/ }))
    expect(screen.queryByText('Thanks for sharing')).not.toBeInTheDocument()
    expect(screen.queryByText(/couldn’t open the share sheet/)).not.toBeInTheDocument()
  })

  it('points to the links when the share sheet fails', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError')), () => true)
    const user = userEvent.setup()
    wrap(<ShareActions content={content} renderImage={() => Promise.resolve(png)} />)
    await user.click(await screen.findByRole('button', { name: /Share…/ }))
    expect(await screen.findByText(/couldn’t open the share sheet/)).toBeInTheDocument()
  })

  it('shares words and a link even when there is no picture to attach', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setShare(share, () => true)
    const user = userEvent.setup()
    wrap(<ShareActions content={{ title: 'Join', text: 'Come along' }} />)
    await user.click(screen.getByRole('button', { name: /Share…/ }))
    expect(share.mock.calls[0]![0].files).toBeUndefined()
  })
})

describe('ShareActions: web links', () => {
  it('links to X, Facebook, WhatsApp and email with the caption and invite link', async () => {
    const repos = createTestRepositories()
    const { code } = await repos.rewards.getReferral()
    wrap(<ShareActions content={content} renderImage={() => Promise.resolve(png)} />, repos)
    const list = await screen.findByRole('list', { name: 'Or post a link' })
    const url = `${window.location.origin}/join?ref=${code}`

    const x = within(list).getByRole('link', { name: /^X/ })
    expect(new URL(x.getAttribute('href')!).searchParams.get('text')).toBe(content.text)
    await waitFor(() => expect(new URL(x.getAttribute('href')!).searchParams.get('url')).toBe(url))
    expect(within(list).getByRole('link', { name: /^Facebook/ })).toBeInTheDocument()
    expect(within(list).getByRole('link', { name: /^WhatsApp/ })).toBeInTheDocument()
    expect(
      within(list)
        .getByRole('link', { name: /^Email/ })
        .getAttribute('href'),
    ).toMatch(/^mailto:/)
  })

  it('opens web networks in a new tab without leaking the opener, and email in place', async () => {
    wrap(<ShareActions content={content} renderImage={() => Promise.resolve(png)} />)
    const list = await screen.findByRole('list', { name: 'Or post a link' })
    for (const name of [/^X/, /^Facebook/, /^WhatsApp/]) {
      const link = within(list).getByRole('link', { name })
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link.getAttribute('rel')).toContain('noreferrer')
      expect(link).toHaveAccessibleName(/opens in a new tab/)
    }
    expect(within(list).getByRole('link', { name: /^Email/ })).not.toHaveAttribute('target')
  })

  it('falls back to the app’s home page when the invite link isn’t available', async () => {
    const repos = createTestRepositories()
    repos.rewards.getReferral = () => Promise.reject(new Error('down'))
    wrap(<ShareActions content={content} renderImage={() => Promise.resolve(png)} />, repos)
    const x = (await screen.findByRole('link', { name: /^X/ })).getAttribute('href')!
    expect(new URL(x).searchParams.get('url')).toBe(`${window.location.origin}/`)
  })

  it('is honest about Instagram and TikTok', async () => {
    wrap(<ShareActions content={content} renderImage={() => Promise.resolve(png)} />)
    expect(
      await screen.findByText(/Instagram and TikTok don’t offer a web sharing link/),
    ).toBeInTheDocument()
  })
})

describe('Share page integration', () => {
  it.each([
    ['/share/restaurant/r-ember', 'Ember & Orchard in Uptown.'],
    ['/share/dish/d-1', 'Order the Charred cauliflower steak at Ember & Orchard.'],
  ])('%s has a Post it panel with its own caption', async (path, caption) => {
    await renderApp(path, { repositories: createTestRepositories() })
    const panel = await screen.findByRole('region', { name: 'Post it' })
    const x = within(panel).getByRole('link', { name: /^X/ })
    expect(new URL(x.getAttribute('href')!).searchParams.get('text')).toContain(caption)
  })

  it('the invite page can share too, with words only', async () => {
    await renderApp('/invite', { repositories: createTestRepositories() })
    const panel = await screen.findByRole('region', { name: 'Post it' })
    expect(within(panel).queryByRole('button', { name: /Save image/ })).not.toBeInTheDocument()
    const x = within(panel).getByRole('link', { name: /^X/ })
    expect(new URL(x.getAttribute('href')!).searchParams.get('text')).toMatch(/^Summer here\./)
  })
})
