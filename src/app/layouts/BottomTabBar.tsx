import { NavLink } from 'react-router'
import { VisuallyHidden } from '@/components'
import { cn } from '@/lib/cn'
import { NAV_ITEMS } from './nav-items'

/** Phone navigation (below md). The primary action (Log) is raised in the center. */
export function BottomTabBar() {
  return (
    <nav
      aria-label="Primary, mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-end justify-around px-2">
        {NAV_ITEMS.map(({ to, label, tabLabel, icon: Icon, end, primary }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
                  primary ? '-mt-5' : isActive ? 'text-primary-strong' : 'text-ink-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {primary ? (
                    <span className="flex size-14 items-center justify-center rounded-pill bg-primary text-on-primary shadow-raised">
                      <Icon aria-hidden className="size-7" />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'flex h-7 w-14 items-center justify-center rounded-pill transition-colors',
                        isActive && 'bg-primary-soft',
                      )}
                    >
                      <Icon aria-hidden className="size-5" />
                    </span>
                  )}
                  <span className={primary ? 'text-primary-strong' : undefined}>
                    {tabLabel ?? label}
                    {tabLabel && (
                      <>
                        {' '}
                        <VisuallyHidden>{label.slice(tabLabel.length).trim()}</VisuallyHidden>
                      </>
                    )}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
