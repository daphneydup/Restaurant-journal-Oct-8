import { LoaderCircle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { VisuallyHidden } from './VisuallyHidden'

export function Spinner({ label = 'Loading', className }: { label?: string; className?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle aria-hidden className={cn('size-5 animate-spin text-primary', className)} />
      <VisuallyHidden>{label}</VisuallyHidden>
    </span>
  )
}
