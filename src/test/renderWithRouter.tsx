import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/routes'

/** Renders the full route tree at `initialPath`, inside the app providers. */
export function renderApp(initialPath = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  const utils = render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { router, ...utils }
}
