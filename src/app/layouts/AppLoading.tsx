import { LoadingRegion, Skeleton } from '@/components'

/** Shown while the first screen's code loads (route-level code splitting). */
export function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-8 md:pt-10">
      <LoadingRegion label="Loading" className="flex flex-col gap-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </LoadingRegion>
    </div>
  )
}
