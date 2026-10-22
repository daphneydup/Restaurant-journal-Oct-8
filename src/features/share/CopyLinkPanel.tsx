import { Check, Link2 } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Button, useToast } from '@/components'
import { copyToClipboard } from '@/lib/clipboard'

/**
 * Copy-link placeholder. The link points at this app's own share route, so it only opens on this
 * device until the back end exists; the panel says so honestly.
 */
export function CopyLinkPanel({
  path,
  label = 'Share link',
  note = 'Preview only: links will open for friends once sharing is connected to the back end.',
}: {
  path: string
  label?: string
  /** Small print under the field. Pass null for none. */
  note?: string | null
}) {
  const inputId = useId()
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const url = new URL(path, window.location.origin).href

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    const ok = await copyToClipboard(url)
    if (ok) {
      setCopied(true)
      showToast('Link copied')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2500)
    } else {
      showToast('Couldn’t copy automatically. Select the link and copy it.', { tone: 'error' })
      document.getElementById(inputId)?.focus()
      ;(document.getElementById(inputId) as HTMLInputElement | null)?.select()
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
      <label htmlFor={inputId} className="flex items-center gap-2 text-sm font-medium">
        <Link2 aria-hidden className="size-4" /> {label}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="min-h-touch min-w-0 flex-1 rounded-md border-2 border-line-strong bg-canvas px-3 text-sm"
        />
        <Button onClick={() => void copy()} aria-live="polite">
          {copied ? (
            <>
              <Check aria-hidden className="size-4" /> Copied
            </>
          ) : (
            'Copy link'
          )}
        </Button>
      </div>
      {note && <p className="text-sm text-ink-muted">{note}</p>}
    </div>
  )
}
