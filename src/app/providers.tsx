import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ToastProvider } from '@/components'
import type { Repositories } from '@/data'
import { RepositoryProvider } from '@/data/RepositoryProvider'
import { createQueryClient } from './queryClient'

/**
 * App-wide providers. The repositories are created once at startup (see main.tsx) and handed in;
 * tests pass zero-latency data and a query client that doesn't retry.
 */
export function AppProviders({
  children,
  repositories,
  queryClient,
}: {
  children: ReactNode
  repositories: Repositories
  queryClient?: QueryClient
}) {
  const [client] = useState(() => queryClient ?? createQueryClient())
  return (
    <RepositoryProvider repositories={repositories}>
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </RepositoryProvider>
  )
}
