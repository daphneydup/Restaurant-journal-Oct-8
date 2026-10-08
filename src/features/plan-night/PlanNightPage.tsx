import { CalendarHeart } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function PlanNightPage() {
  useDocumentTitle('Plan a Night Out')
  return (
    <>
      <PageHeader
        title="Plan a Night Out"
        description="Pick the diets and budget to get a shortlist from your spots."
      />
      <EmptyState
        icon={CalendarHeart}
        title="Coming soon"
        description="This screen is built in a later stage."
      />
    </>
  )
}
