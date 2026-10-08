import { Camera, X } from 'lucide-react'
import { useId, useState, type ChangeEvent } from 'react'
import { IconButton } from '@/components'
import { cn } from '@/lib/cn'
import { buttonStyles } from '@/components/button-styles'
import { fileToResizedDataUrl } from '@/lib/image'

/**
 * Adds up to `max` photos. Each is downscaled in the browser before it is stored, because the
 * mock layer keeps photos in localStorage (Supabase Storage replaces that later).
 */
export function PhotoPicker({
  photos,
  onChange,
  max,
  error,
}: {
  photos: string[]
  onChange: (photos: string[]) => void
  max: number
  error?: string | undefined
}) {
  const inputId = useId()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const full = photos.length >= max

  async function onFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, max - photos.length)
    event.target.value = '' // allow picking the same file again later
    if (files.length === 0) return
    setBusy(true)
    setProblem(null)
    try {
      const added: string[] = []
      for (const file of files) added.push(await fileToResizedDataUrl(file))
      onChange([...photos, ...added])
    } catch {
      setProblem('We couldn’t read that photo. Try a different one.')
    } finally {
      setBusy(false)
    }
  }

  const message = error ?? problem

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">Photos (optional)</p>
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor={inputId}
          className={cn(
            buttonStyles({ variant: 'secondary' }),
            'cursor-pointer has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
            (full || busy) && 'pointer-events-none opacity-50',
          )}
        >
          <Camera aria-hidden className="size-4" />
          {busy ? 'Adding…' : full ? `Limit of ${max} photos` : 'Add a photo'}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            disabled={full || busy}
            onChange={(event) => void onFiles(event)}
            className="sr-only"
          />
        </label>
        <span className="text-sm text-ink-muted">
          {photos.length}/{max}
        </span>
      </div>
      {photos.length > 0 && (
        <ul aria-label="Photos from this visit" className="mt-3 flex flex-wrap gap-3">
          {photos.map((src, index) => (
            <li key={index} className="relative">
              <img
                src={src}
                alt={`Snapshot ${index + 1} from this visit`}
                className="size-24 rounded-md object-cover"
              />
              <IconButton
                label={`Remove photo ${index + 1}`}
                className="absolute -top-2 -right-2 size-9 bg-surface shadow-card"
                onClick={() => onChange(photos.filter((_, i) => i !== index))}
              >
                <X aria-hidden className="size-4" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {message}
        </p>
      )}
    </div>
  )
}
