import { QueryClient } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/routes'
import type { Repositories } from '@/data'
import { createTestRepositories } from './testRepositories'

/** A query client that fails fast and never caches between tests. */
export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

/**
 * Renders the full route tree at `initialPath`, inside the app providers. Screens are
 * lazy-loaded, so this resolves once the first screen's code has loaded.
 */
export async function renderApp(
  initialPath = '/',
  { repositories = createTestRepositories() }: { repositories?: Repositories } = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  const utils = render(
    <AppProviders repositories={repositories} queryClient={createTestQueryClient()}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  // Resolve the moment the first screen's code has loaded (no polling interval to overshoot a
  // short artificial latency), then let React commit it.
  await new Promise<void>((resolve) => {
    if (router.state.initialized) return resolve()
    const unsubscribe = router.subscribe((state) => {
      if (!state.initialized) return
      unsubscribe()
      resolve()
    })
  })
  await act(async () => {})
  return { router, ...utils }
}
