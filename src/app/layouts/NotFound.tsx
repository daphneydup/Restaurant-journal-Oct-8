import { Compass } from 'lucide-react'
import { ButtonLink } from '@/components'
import { EmptyState } from '@/components'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function NotFound() {
  useDocumentTitle('Page not found')
  return (
    <EmptyState
      icon={Compass}
      title="We couldn’t find that page"
      description="The link may be old, or the page may have moved."
      action={<ButtonLink to="/">Back to My Spots</ButtonLink>}
    />
  )
}
