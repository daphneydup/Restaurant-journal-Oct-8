import type { ReactNode } from 'react'
import { Card } from '@/components'

/** The centered card the log-in / sign-up screens sit in. */
export function AuthCard({ children }: { children: ReactNode }) {
  return <Card className="mx-auto flex max-w-md flex-col gap-5">{children}</Card>
}

/** A short notice inside an auth card (a tip, not an error). */
export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-saffron-soft p-3 text-sm text-saffron-strong">{children}</p>
}

/** A failed submit, announced to screen readers. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm font-medium text-ink">
      {message}
    </p>
  )
}
