import { Outlet, ScrollRestoration } from 'react-router'
import { BottomTabBar } from './BottomTabBar'
import { SideNav } from './SideNav'

/** Responsive layout: side nav on md+, bottom tab bar below. */
export function AppShell() {
  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-pill focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        Skip to content
      </a>
      <SideNav />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-28 outline-none md:px-8 md:pt-10 md:pb-12"
      >
        <Outlet />
      </main>
      <BottomTabBar />
      <ScrollRestoration />
    </div>
  )
}
