import { Download, Mail, MessageCircle, Share2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, Spinner, useToast } from '@/components'
import { useReferral } from '@/hooks/queries'
import { referralLink } from '@/lib/pendingReferral'
import {
  canNativeShare,
  downloadBlob,
  shareFileName,
  shareLinks,
  shareNative,
  type ShareLink,
} from '@/lib/share'
import { renderShareImage, type ShareImageSpec } from '@/lib/shareImage'
import type { ShareContent } from './shareContent'

type ImageState =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ready'; blob: Blob; previewUrl: string | null }
  | { status: 'failed' }

const LINK_ICONS: Partial<Record<ShareLink['id'], typeof Mail>> = {
  email: Mail,
  whatsapp: MessageCircle,
}

/**
 * "Post it": the picture plus the ways to get it (and a caption) onto social media. The picture
 * is made as soon as the panel appears, so by the time someone taps Share it is ready to attach:
 * browsers only allow the share sheet right after a tap.
 *
 * The caption carries the person's invite link, so a friend who joins from a post earns them
 * both points. Without it (still loading, or unavailable) the link is the app's home page.
 */
export function ShareActions({
  content,
  renderImage = renderShareImage,
}: {
  content: ShareContent
  /** Replaceable in tests, where canvas doesn't exist. */
  renderImage?: (spec: ShareImageSpec) => Promise<Blob>
}) {
  const { showToast } = useToast()
  const referral = useReferral()
  const [result, setResult] = useState<{ key: string; state: ImageState } | null>(null)
  const [sharing, setSharing] = useState(false)

  const url = referral.data ? referralLink(referral.data.code) : `${window.location.origin}/`
  const payload = useMemo(
    () => ({ title: content.title, text: content.text, url }),
    [content.title, content.text, url],
  )
  const links = useMemo(() => shareLinks(payload), [payload])
  const fileName = content.fileName ?? shareFileName(content.title)

  // Draw the picture once per distinct spec. The state shown is derived from the latest result,
  // so a new spec shows "preparing" until its own picture arrives.
  const specKey = JSON.stringify(content.image ?? null)
  useEffect(() => {
    const spec = content.image
    if (!spec) return
    let cancelled = false
    let previewUrl: string | null = null
    renderImage(spec).then(
      (blob) => {
        if (cancelled) return
        previewUrl = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : null
        setResult({ key: specKey, state: { status: 'ready', blob, previewUrl } })
      },
      () => {
        if (!cancelled) setResult({ key: specKey, state: { status: 'failed' } })
      },
    )
    return () => {
      cancelled = true
      if (previewUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrl)
    }
    // specKey stands for the spec's contents, so a new object with the same data doesn't redraw.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey, renderImage])

  const image: ImageState = !content.image
    ? { status: 'none' }
    : result?.key === specKey
      ? result.state
      : { status: 'loading' }

  async function share() {
    setSharing(true)
    try {
      const file =
        image.status === 'ready'
          ? new File([image.blob], fileName, { type: 'image/png' })
          : undefined
      const result = await shareNative(payload, file)
      if (result === 'shared') showToast('Thanks for sharing')
      if (result === 'unsupported') {
        showToast('Sharing isn’t available here. Use a link below.', { tone: 'error' })
      }
    } catch {
      showToast('We couldn’t open the share sheet. Try a link below.', { tone: 'error' })
    } finally {
      setSharing(false)
    }
  }

  const preparing = image.status === 'loading'

  return (
    <section
      aria-labelledby="post-heading"
      className="flex flex-col gap-4 rounded-card bg-surface p-4 shadow-card md:p-5"
    >
      <div>
        <h2 id="post-heading" className="text-xl">
          Post it
        </h2>
        <p className="text-sm text-ink-muted">
          Share to your social media. Your invite link is included, so friends who join earn you
          both points.
        </p>
      </div>

      {image.status === 'ready' && image.previewUrl && (
        <img
          src={image.previewUrl}
          alt="Preview of the card you’ll share"
          className="mx-auto max-h-96 w-auto max-w-full rounded-md border border-line"
        />
      )}
      {preparing && (
        <p role="status" className="flex items-center gap-2 text-sm text-ink-muted">
          <Spinner label="Preparing" /> Preparing your image…
        </p>
      )}
      {image.status === 'failed' && (
        <p role="status" className="text-sm text-ink-muted">
          We couldn’t make the picture on this device, but you can still share the link.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canNativeShare() && (
          <Button onClick={() => void share()} disabled={preparing || sharing}>
            <Share2 aria-hidden className="size-4" /> Share…
          </Button>
        )}
        {image.status === 'ready' && (
          <Button variant="secondary" onClick={() => downloadBlob(image.blob, fileName)}>
            <Download aria-hidden className="size-4" /> Save image
          </Button>
        )}
      </div>

      <div>
        <h3 id="links-heading" className="mb-2 font-sans text-sm font-semibold text-ink-muted">
          Or post a link
        </h3>
        <ul aria-labelledby="links-heading" className="flex flex-wrap gap-2">
          {links.map((link) => {
            const Icon = LINK_ICONS[link.id]
            return (
              <li key={link.id}>
                <a
                  href={link.href}
                  target={link.id === 'email' ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  className="inline-flex min-h-touch items-center gap-2 rounded-control border border-primary/50 px-4 text-sm font-semibold text-primary-strong transition-colors hover:bg-primary-soft"
                >
                  {Icon && <Icon aria-hidden className="size-4" />}
                  {link.label}
                  {link.id !== 'email' && <span className="sr-only"> (opens in a new tab)</span>}
                </a>
              </li>
            )
          })}
        </ul>
      </div>

      <p className="text-xs text-ink-muted">
        Instagram and TikTok don’t offer a web sharing link. On a phone, <strong>Share…</strong>{' '}
        lists them; otherwise save the image and post it from the app.
      </p>
    </section>
  )
}
