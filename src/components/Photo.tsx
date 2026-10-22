import { useState, type ReactNode } from 'react'
import { PHOTOS, photoUrl, type PhotoName } from '@/lib/photos'
import { cn } from '@/lib/cn'

/**
 * A decorative photograph that fails gracefully: a gold-and-black gradient sits behind it, so if
 * the picture is missing or slow the layout still looks intentional. It is hidden from assistive
 * technology (`alt=""`) unless an `alt` is given, since these photos set a mood and carry no
 * information. An optional dark gradient on top keeps any text over it readable.
 */
export function Photo({
  name,
  alt = '',
  className,
  imgClassName,
  position = 'center',
  scrim = 'bottom',
  priority = false,
  children,
}: {
  name: PhotoName
  alt?: string
  className?: string
  imgClassName?: string
  /** CSS object-position, e.g. "center top" to keep the lamps in a wide crop. */
  position?: string
  /** Where the dark overlay sits: behind text at the bottom, over everything, or none. */
  scrim?: 'bottom' | 'full' | 'none'
  /** Load straight away (for the first screen) instead of lazily. */
  priority?: boolean
  /** Content laid over the photo. */
  children?: ReactNode
}) {
  const [failed, setFailed] = useState(false)
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden bg-gradient-to-br from-primary-soft via-surface to-canvas',
        className,
      )}
    >
      {!failed && (
        <img
          src={photoUrl(name, 800)}
          srcSet={`${photoUrl(name, 800)} 800w, ${photoUrl(name, 1600)} 1600w`}
          sizes="(min-width: 768px) 48rem, 100vw"
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          style={{ objectPosition: position }}
          className={cn('absolute inset-0 -z-10 size-full object-cover', imgClassName)}
        />
      )}
      {scrim !== 'none' && (
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 -z-10',
            scrim === 'full'
              ? 'bg-canvas/70'
              : 'bg-gradient-to-t from-canvas via-canvas/55 to-canvas/10',
          )}
        />
      )}
      {children}
    </div>
  )
}

/** "Photography: A, B and C on Unsplash", linking each name to its photo page. */
export function PhotoCredits({ names }: { names: readonly PhotoName[] }) {
  return (
    <p className="text-xs text-ink-muted">
      Photography on Unsplash:{' '}
      {names.map((name, i) => (
        <span key={name}>
          {i > 0 && (i === names.length - 1 ? ' and ' : ', ')}
          <a
            href={PHOTOS[name].url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-ink"
          >
            {PHOTOS[name].photographer}
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </span>
      ))}
      .
    </p>
  )
}
