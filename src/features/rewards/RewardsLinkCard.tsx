import { ChevronRight, Gem, UserPlus } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '@/components'
import { useRewardsSummary } from '@/hooks/queries'
import { formatPoints } from './rewardMeta'

/** Entry points to Rewards and Invite from Profile, where the mobile tab bar has no room for them. */
export function RewardsLinkCard() {
  const summary = useRewardsSummary()
  const rows = [
    {
      to: '/rewards',
      icon: Gem,
      title: 'Rewards',
      detail: summary.data ? `${formatPoints(summary.data.balance)} points` : 'Points and perks',
    },
    { to: '/invite', icon: UserPlus, title: 'Invite friends', detail: 'You both earn points' },
  ]
  return (
    <Card className="p-0 md:p-0">
      <ul className="divide-y divide-line">
        {rows.map(({ to, icon: Icon, title, detail }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-sunken md:px-5"
            >
              <Icon aria-hidden className="size-5 shrink-0 text-primary-strong" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm text-ink-muted">{detail}</span>
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  )
}
