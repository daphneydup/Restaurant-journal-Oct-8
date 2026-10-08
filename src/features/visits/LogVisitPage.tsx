import { NotebookPen } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function LogVisitPage() {
  useDocumentTitle('Log a Visit')
  return (
    <>
      <PageHeader
        title="Log a Visit"
        description="Capture how a place worked for each diet in about 30 seconds."
      />
      <EmptyState
        icon={NotebookPen}
        title="Coming soon"
        description="This screen is built in a later stage."
      />
    </>
  )
}
