import type { RouteObject } from 'react-router'
import { AppLoading } from './layouts/AppLoading'
import { AppShell } from './layouts/AppShell'
import { NotFound } from './layouts/NotFound'
import { RouteError } from './layouts/RouteError'

/**
 * Each screen is its own chunk, loaded when first visited. The shell, error page and
 * not-found page stay in the main bundle so they can always render.
 */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    HydrateFallback: AppLoading,
    children: [
      {
        index: true,
        lazy: async () => ({
          Component: (await import('@/features/restaurants/MySpotsPage')).MySpotsPage,
        }),
      },
      {
        path: 'spots/:restaurantId',
        lazy: async () => ({
          Component: (await import('@/features/restaurants/RestaurantDetailPage'))
            .RestaurantDetailPage,
        }),
      },
      {
        path: 'log',
        lazy: async () => ({
          Component: (await import('@/features/visits/LogVisitPage')).LogVisitPage,
        }),
      },
      {
        path: 'go-back',
        lazy: async () => ({
          Component: (await import('@/features/go-back/GoBackPage')).GoBackPage,
        }),
      },
      {
        path: 'plan',
        lazy: async () => ({
          Component: (await import('@/features/plan-night/PlanNightPage')).PlanNightPage,
        }),
      },
      {
        path: 'share/:kind/:id',
        lazy: async () => ({
          Component: (await import('@/features/share/SharePage')).SharePage,
        }),
      },
      {
        path: 'profile',
        lazy: async () => ({
          Component: (await import('@/features/profile/ProfilePage')).ProfilePage,
        }),
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]
