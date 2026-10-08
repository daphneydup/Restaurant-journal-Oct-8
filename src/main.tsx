import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { createRepositories } from '@/data'
import '@/styles/index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

// Which data layer runs (demo data or Supabase) is decided once, before the first render.
try {
  const repositories = await createRepositories()
  createRoot(root).render(
    <StrictMode>
      <AppProviders repositories={repositories}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  )
} catch (error) {
  console.error('The app could not start', error)
  // No React yet, so write plain, accessible text.
  root.innerHTML =
    '<main style="max-width:32rem;margin:4rem auto;padding:0 1rem;font-family:system-ui,sans-serif">' +
    '<h1 style="font-size:1.5rem">We couldn’t start Table for Everyone</h1>' +
    '<p>Check your connection and reload the page. If it keeps happening, your Supabase settings in <code>.env.local</code> may be wrong.</p>' +
    '</main>'
}
