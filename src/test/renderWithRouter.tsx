import { QueryClient } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/routes'
import type { Repositories } from '@/data'
import { createTestRepositories } from './testRepositories'

/** A query client that fails fast and never caches between tests. */
export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

/** Renders the full route tree at `initialPath`, inside the app providers. */
export function renderApp(
  initialPath = '/',
  { repositories = createTestRepositories() }: { repositories?: Repositories } = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  const utils = render(
    <AppProviders repositories={repositories} queryClient={createTestQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, ...utils }
}
