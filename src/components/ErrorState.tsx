import { TriangleAlert } from 'lucide-react'
import { Button } from './Button'

export function ErrorState({
  title = 'Something went wrong',
  message = 'We couldn’t load this right now. Please try again.',
  onRetry,
}: {
  title?: string
  message?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-card bg-danger-soft px-6 py-10 text-center"
    >
      <TriangleAlert aria-hidden className="size-8 text-danger" />
      <h2 className="text-xl">{title}</h2>
      <p className="max-w-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
