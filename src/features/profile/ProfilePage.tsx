import { ErrorState, LoadingRegion, PageHeader, Skeleton } from '@/components'
import { useDietLenses, useProfile } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { DevTools } from './DevTools'
import { ProfileForm } from './ProfileForm'

export function ProfilePage() {
  useDocumentTitle('Profile')
  const profile = useProfile()
  const lenses = useDietLenses()

  let body
  if (profile.isError || lenses.isError) {
    body = (
      <ErrorState
        title="We couldn’t load your profile"
        onRetry={() => {
          if (profile.isError) void profile.refetch()
          if (lenses.isError) void lenses.refetch()
        }}
      />
    )
  } else if (!profile.data || !lenses.data) {
    body = (
      <LoadingRegion label="Loading your profile" className="flex flex-col gap-4">
        <Skeleton className="h-52 rounded-card" />
        <Skeleton className="h-36 rounded-card" />
      </LoadingRegion>
    )
  } else {
    // Keyed so the form restarts from fresh data after a demo-data reset.
    body = (
      <ProfileForm key={JSON.stringify(profile.data)} profile={profile.data} lenses={lenses.data} />
    )
  }

  return (
    <>
      <PageHeader title="Profile" description="Your name, default diets and home city." />
      <div className="flex flex-col gap-5">
        {body}
        <DevTools />
      </div>
    </>
  )
}
