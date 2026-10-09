import { LogIn, UserRound } from 'lucide-react'
import { NavLink } from 'react-router'
import { useAccount } from '@/hooks/queries'
import { cn } from '@/lib/cn'
import { NAV_ITEMS } from './nav-items'

/** Desktop/tablet navigation (md and up). */
export function SideNav() {
  const account = useAccount()
  const member = account.data && !account.data.isGuest ? account.data : null
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-line bg-surface px-4 py-8 md:flex">
      <div className="px-3">
        <p className="font-display text-xl font-semibold text-primary-strong">Table for Everyone</p>
        <p className="text-sm text-ink-muted">Dining that works for the whole group</p>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end, primary }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-touch items-center gap-3 rounded-pill px-4 font-medium transition-colors',
                    primary
                      ? 'bg-primary text-white hover:bg-primary-hover'
                      : isActive
                        ? 'bg-primary-soft text-primary-strong'
                        : 'text-ink hover:bg-surface-sunken',
                  )
                }
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="mt-auto">
          <NavLink
            to={member ? '/account' : '/login'}
            className={({ isActive }) =>
              cn(
                'flex min-h-touch items-center gap-3 rounded-pill px-4 font-medium transition-colors',
                isActive
                  ? 'bg-primary-soft text-primary-strong'
                  : 'text-ink hover:bg-surface-sunken',
              )
            }
          >
            {member ? (
              <UserRound aria-hidden className="size-5" />
            ) : (
              <LogIn aria-hidden className="size-5" />
            )}
            <span className="min-w-0">
              {member ? (
                <>
                  <span className="block">Account</span>
                  <span className="block truncate text-xs font-normal text-ink-muted">
                    {member.email}
                  </span>
                </>
              ) : (
                'Log in or sign up'
              )}
            </span>
          </NavLink>
        </div>
      </nav>
    </aside>
  )
}
