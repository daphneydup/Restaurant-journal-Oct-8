import { Store } from 'lucide-react'
import { useParams } from 'react-router'
import { ButtonLink, EmptyState, PageHeader } from '@/components'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function RestaurantDetailPage() {
  const { restaurantId } = useParams()
  useDocumentTitle('Restaurant')
  return (
    <>
      <PageHeader title="Restaurant" description={`Spot ${restaurantId ?? ''}`} />
      <EmptyState
        icon={Store}
        title="Coming soon"
        description="Visit history, diet breakdown and dishes are built in a later stage."
        action={<ButtonLink to="/">Back to My Spots</ButtonLink>}
      />
    </>
  )
}
