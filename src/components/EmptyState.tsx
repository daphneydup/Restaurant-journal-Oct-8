import type { ComponentType, ReactNode } from 'react'
import type { PhotoName } from '@/lib/photos'
import { Photo } from './Photo'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  photo,
}: {
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  description?: string
  action?: ReactNode
  /** A mood photograph above the message, for first-run screens. */
  photo?: PhotoName
}) {
  return (
    <div className="flex flex-col items-center gap-3 overflow-hidden rounded-card border border-line px-6 py-12 text-center">
      {photo && <Photo name={photo} className="-mx-6 -mt-12 mb-4 h-40 w-[calc(100%+3rem)]" />}
      {Icon && (
        <span className="flex size-14 items-center justify-center rounded-pill bg-saffron-soft text-saffron-strong">
          <Icon aria-hidden className="size-7" />
        </span>
      )}
      <h2 className="text-xl">{title}</h2>
      {description && <p className="max-w-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
