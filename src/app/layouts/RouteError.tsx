import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'
import { ErrorState } from '@/components'

/** Router-level error boundary: catches render/loader errors for any route. */
export function RouteError() {
  const error = useRouteError()
  const navigate = useNavigate()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'An unexpected error occurred.'
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <ErrorState message={message} onRetry={() => void navigate(0)} />
    </div>
  )
}
