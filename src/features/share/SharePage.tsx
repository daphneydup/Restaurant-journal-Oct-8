import { Share2 } from 'lucide-react'
import { useParams } from 'react-router'
import { EmptyState, PageHeader } from '@/components'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function SharePage() {
  const { kind, id } = useParams()
  useDocumentTitle('Share')
  return (
    <>
      <PageHeader title="Share" description={`${kind ?? ''} ${id ?? ''}`.trim()} />
      <EmptyState
        icon={Share2}
        title="Coming soon"
        description="The share card is built in a later stage."
      />
    </>
  )
}
