import type { RouteObject } from 'react-router'
import { GoBackPage } from '@/features/go-back/GoBackPage'
import { PlanNightPage } from '@/features/plan-night/PlanNightPage'
import { ProfilePage } from '@/features/profile/ProfilePage'
import { MySpotsPage } from '@/features/restaurants/MySpotsPage'
import { RestaurantDetailPage } from '@/features/restaurants/RestaurantDetailPage'
import { SharePage } from '@/features/share/SharePage'
import { LogVisitPage } from '@/features/visits/LogVisitPage'
import { AppShell } from './layouts/AppShell'
import { NotFound } from './layouts/NotFound'
import { RouteError } from './layouts/RouteError'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <MySpotsPage /> },
      { path: 'spots/:restaurantId', element: <RestaurantDetailPage /> },
      { path: 'log', element: <LogVisitPage /> },
      { path: 'go-back', element: <GoBackPage /> },
      { path: 'plan', element: <PlanNightPage /> },
      { path: 'share/:kind/:id', element: <SharePage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]
