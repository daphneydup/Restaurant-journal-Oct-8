import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canNativeShare,
  canShareFile,
  downloadBlob,
  shareFileName,
  shareLinks,
  shareNative,
} from './share'

const payload = {
  title: 'Ember & Orchard on Table for Everyone',
  text: 'Worked for everyone! 100% “great” & vegan-friendly',
  url: 'https://example.com/join?ref=TFE-ABC234',
}
const file = new File(['x'], 'card.png', { type: 'image/png' })

function setNavigator(share?: unknown, canShare?: unknown) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true })
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true })
}
afterEach(() => {
  Reflect.deleteProperty(navigator, 'share')
  Reflect.deleteProperty(navigator, 'canShare')
  vi.restoreAllMocks()
})

describe('shareLinks', () => {
  const links = Object.fromEntries(shareLinks(payload).map((l) => [l.id, l.href]))

  it('offers X, Facebook, WhatsApp and email', () => {
    expect(Object.keys(links)).toEqual(['x', 'facebook', 'whatsapp', 'email'])
  })

  it('encodes text and links so characters like & # and quotes survive', () => {
    const x = new URL(links.x!)
    expect(x.origin + x.pathname).toBe('https://twitter.com/intent/tweet')
    expect(x.searchParams.get('text')).toBe(payload.text)
    expect(x.searchParams.get('url')).toBe(payload.url)

    const fb = new URL(links.facebook!)
    expect(fb.searchParams.get('u')).toBe(payload.url)
    expect(fb.searchParams.get('quote')).toBe(payload.text)

    const wa = new URL(links.whatsapp!)
    expect(wa.searchParams.get('text')).toBe(`${payload.text} ${payload.url}`)

    const mail = new URL(links.email!)
    expect(mail.protocol).toBe('mailto:')
    expect(mail.searchParams.get('subject')).toBe(payload.title)
    expect(mail.searchParams.get('body')).toBe(`${payload.text}\n\n${payload.url}`)
  })
})

describe('shareFileName', () => {
  it.each([
    ['Ember & Orchard', 'ember-orchard.png'],
    ['Café Brûlée!', 'cafe-brulee.png'],
    ['   ', 'table-for-everyone.png'],
    ['日本語', 'table-for-everyone.png'],
    ['a'.repeat(100), `${'a'.repeat(40)}.png`],
  ])('%s -> %s', (title, expected) => expect(shareFileName(title)).toBe(expected))

  it('takes another extension', () => expect(shareFileName('Soup', 'jpg')).toBe('soup.jpg'))
})

describe('native sharing', () => {
  it('reports no support when the browser has no share sheet', async () => {
    expect(canNativeShare()).toBe(false)
    expect(await shareNative(payload)).toBe('unsupported')
    expect(canShareFile(file)).toBe(false)
  })

  it('shares text and link, and attaches the picture only when the browser can carry it', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    setNavigator(share, () => true)
    expect(await shareNative(payload, file)).toBe('shared')
    expect(share).toHaveBeenLastCalledWith({ ...payload, files: [file] })

    setNavigator(share, () => false)
    await shareNative(payload, file)
    expect(share).toHaveBeenLastCalledWith(payload)

    setNavigator(share, undefined) // canShare missing: older browsers
    await shareNative(payload, file)
    expect(share).toHaveBeenLastCalledWith(payload)
  })

  it('treats closing the sheet as a cancel, not an error', async () => {
    setNavigator(vi.fn().mockRejectedValue(new DOMException('closed', 'AbortError')))
    expect(await shareNative(payload)).toBe('cancelled')
  })

  it('lets real failures through', async () => {
    setNavigator(vi.fn().mockRejectedValue(new DOMException('blocked', 'NotAllowedError')))
    await expect(shareNative(payload)).rejects.toThrow('blocked')
  })

  it('survives canShare throwing', () => {
    setNavigator(vi.fn(), () => {
      throw new Error('boom')
    })
    expect(canShareFile(file)).toBe(false)
  })
})

describe('downloadBlob', () => {
  it('saves the blob under the given name through a temporary link', () => {
    vi.useFakeTimers()
    const create = vi.fn().mockReturnValue('blob:fake')
    const revoke = vi.fn()
    URL.createObjectURL = create
    URL.revokeObjectURL = revoke
    let seen: { download: string | null; href: string | null; attached: boolean } | undefined
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      seen = {
        download: this.getAttribute('download'),
        href: this.getAttribute('href'),
        attached: document.body.contains(this),
      }
    })

    downloadBlob(new Blob(['x']), 'card.png')
    expect(seen).toEqual({ download: 'card.png', href: 'blob:fake', attached: true })
    expect(document.querySelector('a[download]')).toBeNull() // cleaned up
    expect(revoke).not.toHaveBeenCalled() // not yet: the download may start late
    vi.advanceTimersByTime(10_000)
    expect(revoke).toHaveBeenCalledWith('blob:fake')
    vi.useRealTimers()
  })
})
