import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'

/**
 * Modal built on the native <dialog>: the browser traps focus, makes the page behind inert,
 * closes on Escape and restores focus to the opener. `variant="sheet"` slides up from the
 * bottom on phones and centers from `md` up.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  variant = 'center',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Pinned below the scrolling content, so the primary action never scrolls out of reach. */
  footer?: ReactNode
  variant?: 'center' | 'sheet'
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    // The backdrop click is a mouse-only shortcut. Keyboard and assistive-tech users close the
    // dialog with Escape (native) or the Close button, so no key handler is needed here.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Fires for Escape and for dialog.close(); keeps `open` in sync with the browser.
      onClose={onClose}
      // A click on the backdrop lands on the <dialog> element itself, never on its content.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className={cn(
        'w-full max-w-lg rounded-sheet bg-surface p-0 text-ink shadow-raised backdrop:bg-ink/50',
        variant === 'sheet'
          ? 'm-0 mt-auto max-h-[90dvh] max-w-none rounded-b-none md:m-auto md:max-w-lg md:rounded-b-sheet'
          : 'm-auto',
      )}
    >
      {open && (
        <div className="flex max-h-[90dvh] flex-col">
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
            <h2 id={titleId} className="text-xl">
              {title}
            </h2>
            <IconButton label="Close" onClick={onClose}>
              <X aria-hidden className="size-5" />
            </IconButton>
          </div>
          <div className={cn('overflow-y-auto px-5 pt-2', footer ? 'pb-4' : 'pb-6')}>
            {children}
          </div>
          {footer && (
            <div className="border-t border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  )
}
