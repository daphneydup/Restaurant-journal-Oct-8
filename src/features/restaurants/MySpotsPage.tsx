import { UtensilsCrossed } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function MySpotsPage() {
  useDocumentTitle('My Spots')
  return (
    <>
      <PageHeader
        title="My Spots"
        description="Your trusted shortlist of places that work for everyone."
      />
      <EmptyState
        icon={UtensilsCrossed}
        title="Coming soon"
        description="This screen is built in a later stage."
      />
    </>
  )
}
