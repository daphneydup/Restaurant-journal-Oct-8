import { ImagePlay, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components'
import type { Gif } from '@/types'
import { GifPicker } from './GifPicker'

export interface ChosenGif {
  url: string
  title: string
  /** Set when it came from the picker in this session; absent for one saved earlier. */
  pageUrl?: string
}

/**
 * "Add a GIF": a button that opens the picker, then shows the choice with a way to remove it.
 * Controlled, so the form (or the share panel) owns the value.
 */
export function GifField({
  value,
  onChange,
  label = 'Reaction GIF (optional)',
  error,
}: {
  value: ChosenGif | undefined
  onChange: (gif: ChosenGif | undefined) => void
  label?: string
  error?: string | undefined
}) {
  const [open, setOpen] = useState(false)

  function pick(gif: Gif) {
    onChange({ url: gif.url, title: gif.title, pageUrl: gif.pageUrl })
    setOpen(false)
  }

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      {value ? (
        <div className="flex items-start gap-3">
          <img
            src={value.url}
            alt={value.title}
            className="max-h-32 max-w-[60%] rounded-md border border-line object-contain"
          />
          <div className="flex flex-col items-start gap-2">
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Change GIF
            </Button>
            <Button
              variant="secondary"
              aria-label={`Remove GIF: ${value.title}`}
              onClick={() => onChange(undefined)}
            >
              <X aria-hidden className="size-4" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <ImagePlay aria-hidden className="size-4" /> Add a GIF
        </Button>
      )}
      {error && <p className="mt-1 text-sm font-medium text-danger">{error}</p>}
      <GifPicker open={open} onClose={() => setOpen(false)} onPick={pick} />
    </div>
  )
}
