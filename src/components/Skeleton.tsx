import { cn } from '@/lib/cn'

/** Decorative placeholder block. Wrap a group in <LoadingRegion> to announce loading once. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-sunken', className)} />
}
