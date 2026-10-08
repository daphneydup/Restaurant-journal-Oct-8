import type { ComponentType, ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-line px-6 py-12 text-center">
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
