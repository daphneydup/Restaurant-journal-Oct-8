/**
 * Getting content out to other apps. There is no "post to Instagram" API for a web page, and
 * asking for people's social logins would be worse, so this uses what browsers do offer:
 *  - the native share sheet (Web Share API), which on a phone lists Instagram, TikTok,
 *    Messages, WhatsApp and the rest, and can carry the image itself
 *  - web share links for the networks that have one (X, Facebook, WhatsApp, email)
 *  - saving the image, to post it by hand
 */

export type NativeShareResult = 'shared' | 'cancelled' | 'unsupported'

export interface SharePayload {
  title: string
  text: string
  url: string
}

/** True when the browser can open the native share sheet at all. */
export function canNativeShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** True when the native share sheet can also carry this file (not every browser can). */
export function canShareFile(file: File): boolean {
  if (!canNativeShare() || typeof navigator.canShare !== 'function') return false
  try {
    return navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

/**
 * Opens the native share sheet. Closing it without choosing an app is not an error (`cancelled`).
 * The file is only attached when the browser says it can carry it.
 */
export async function shareNative(payload: SharePayload, file?: File): Promise<NativeShareResult> {
  if (!canNativeShare()) return 'unsupported'
  const data: ShareData = { ...payload }
  if (file && canShareFile(file)) data.files = [file]
  try {
    await navigator.share(data)
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    throw error
  }
}

export interface ShareLink {
  id: 'x' | 'facebook' | 'whatsapp' | 'email'
  label: string
  href: string
}

/** Web share links. Text and URL are encoded, so any characters are safe to pass. */
export function shareLinks({ title, text, url }: SharePayload): ShareLink[] {
  const enc = encodeURIComponent
  return [
    {
      id: 'x',
      label: 'X',
      href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}&quote=${enc(text)}`,
    },
    { id: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    {
      id: 'email',
      label: 'Email',
      href: `mailto:?subject=${enc(title)}&body=${enc(`${text}\n\n${url}`)}`,
    },
  ]
}

/** A file name that is safe on every system: "Ember & Orchard" becomes "ember-orchard.png". */
export function shareFileName(title: string, extension = 'png'): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${slug || 'table-for-everyone'}.${extension}`
}

/** Saves a blob as a file by clicking a temporary link. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoked a moment later: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
