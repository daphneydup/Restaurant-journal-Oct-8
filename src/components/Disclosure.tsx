import { ChevronDown } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Show/hide section. The panel stays mounted (just `hidden`), so form fields inside keep their
 * values and validation while collapsed.
 */
export function Disclosure({
  label,
  description,
  open,
  onOpenChange,
  children,
}: {
  label: string
  description?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  const panelId = useId()
  return (
    <section className="rounded-card bg-surface shadow-card">
      <h2 className="font-sans text-base">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => onOpenChange(!open)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-card px-4 text-left font-semibold md:px-5"
        >
          <span>
            {label}
            {description && (
              <span className="block text-sm font-normal text-ink-muted">{description}</span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={cn('size-5 shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>
      </h2>
      <div id={panelId} hidden={!open} className="flex flex-col gap-6 px-4 pt-1 pb-5 md:px-5">
        {children}
      </div>
    </section>
  )
}
