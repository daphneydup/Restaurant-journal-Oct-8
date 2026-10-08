import { Bookmark } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function GoBackPage() {
  useDocumentTitle('Go Back')
  return (
    <>
      <PageHeader title="Go Back" description="Places you want to revisit, longest wait first." />
      <EmptyState
        icon={Bookmark}
        title="Coming soon"
        description="This screen is built in a later stage."
      />
    </>
  )
}
