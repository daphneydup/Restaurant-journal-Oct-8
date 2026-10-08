import type { ReactNode } from 'react'
import { VisuallyHidden } from './VisuallyHidden'

/** Groups skeletons and announces a single "Loading" message to assistive tech. */
export function LoadingRegion({
  label = 'Loading',
  children,
  className,
}: {
  label?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <VisuallyHidden>{label}</VisuallyHidden>
      {children}
    </div>
  )
}
