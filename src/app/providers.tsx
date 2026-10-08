import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ToastProvider } from '@/components'
import { createRepositories } from '@/data'
import type { Repositories } from '@/data'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { createQueryClient } from './queryClient'

/**
 * App-wide providers. `repositories` and `queryClient` are injectable so tests can supply
 * zero-latency data and a client that doesn't retry.
 */
export function AppProviders({
  children,
  repositories,
  queryClient,
}: {
  children: ReactNode
  repositories?: Repositories
  queryClient?: QueryClient
}) {
  const [repos] = useState(() => repositories ?? createRepositories())
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <RepositoryProvider repositories={repos}>
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </RepositoryProvider>
  )
}
