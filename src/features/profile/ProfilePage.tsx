import { User } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function ProfilePage() {
  useDocumentTitle('Profile')
  return (
    <>
      <PageHeader title="Profile" description="Your name, default diets and home city." />
      <EmptyState
        icon={User}
        title="Coming soon"
        description="This screen is built in a later stage."
      />
    </>
  )
}
