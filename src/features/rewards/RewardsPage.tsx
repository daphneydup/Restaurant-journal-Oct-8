import { Gem } from 'lucide-react'
import { useState } from 'react'
import {
  ButtonLink,
  ConfirmDialog,
  Disclosure,
  EmptyState,
  ErrorState,
  LoadingRegion,
  PageHeader,
  Skeleton,
  useToast,
} from '@/components'
import { isRepositoryError } from '@/data'
import {
  useMarkVoucherUsed,
  useRedeemReward,
  useRewardCatalog,
  useRewardsSummary,
  useVouchers,
} from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useNow } from '@/hooks/useNow'
import { pointsToNextReward, voucherState } from '@/lib/rewardRules'
import type { Reward, Voucher } from '@/types'
import { TestimonialCarousel } from '@/features/testimonials/TestimonialCarousel'
import { BalanceHero } from './BalanceHero'
import { HowYouEarn } from './HowYouEarn'
import { PointsHistory } from './PointsHistory'
import { formatPoints } from './rewardMeta'
import { RewardCard } from './RewardCard'
import { VoucherCard } from './VoucherCard'

export function RewardsPage() {
  useDocumentTitle('Rewards')
  const now = useNow()
  const { showToast } = useToast()
  const summary = useRewardsSummary()
  const catalog = useRewardCatalog()
  const vouchers = useVouchers()
  const redeem = useRedeemReward()
  const markUsed = useMarkVoucherUsed()
  const [pending, setPending] = useState<Reward | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const queries = [summary, catalog, vouchers]
  let body
  if (queries.some((q) => q.isError)) {
    body = (
      <ErrorState
        title="We couldn’t load your rewards"
        onRetry={() => queries.filter((q) => q.isError).forEach((q) => void q.refetch())}
      />
    )
  } else if (!summary.data || !catalog.data || !vouchers.data) {
    body = (
      <LoadingRegion label="Loading your rewards" className="flex flex-col gap-4">
        <Skeleton className="h-44 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
        <Skeleton className="h-32 rounded-card" />
      </LoadingRegion>
    )
  } else {
    const { balance } = summary.data
    const live = vouchers.data.filter((v) => voucherState(v, now) === 'active')
    const past = vouchers.data.filter((v) => voucherState(v, now) !== 'active')
    const ordered = [...live, ...past]

    body = (
      <div className="flex flex-col gap-8">
        <BalanceHero
          summary={summary.data}
          pointsToNext={pointsToNextReward(
            balance,
            catalog.data.map((r) => r.cost),
          )}
        />

        <section aria-labelledby="vouchers-heading">
          <h2 id="vouchers-heading" className="mb-3 text-xl">
            Your vouchers
          </h2>
          {ordered.length === 0 ? (
            <EmptyState
              icon={Gem}
              title="No vouchers yet"
              description="Redeem a perk below and its code will wait for you here."
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {ordered.map((voucher) => (
                <VoucherCard
                  key={voucher.id}
                  voucher={voucher}
                  now={now}
                  busy={markUsed.isPending}
                  onUse={(v: Voucher) =>
                    markUsed.mutate(v.id, {
                      onSuccess: () => showToast(`${v.title} marked as used`),
                      onError: () =>
                        showToast('We couldn’t update that voucher. Please try again.', {
                          tone: 'error',
                        }),
                    })
                  }
                />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="perks-heading">
          <h2 id="perks-heading" className="text-xl">
            Perks
          </h2>
          <p className="mt-1 mb-3 text-sm text-ink-muted">
            A sample menu: these partners are fictional, so vouchers can’t be used at a real
            restaurant yet.
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {catalog.data.map((reward) => (
              <RewardCard key={reward.id} reward={reward} balance={balance} onRedeem={setPending} />
            ))}
          </ul>
        </section>

        <HowYouEarn />

        <TestimonialCarousel />

        <Disclosure
          label="Points history"
          description={`${summary.data.entries.length} entries`}
          open={historyOpen}
          onOpenChange={setHistoryOpen}
        >
          <PointsHistory entries={summary.data.entries} />
        </Disclosure>

        <ConfirmDialog
          open={pending !== null}
          title={pending ? `Redeem ${pending.title}?` : 'Redeem'}
          confirmLabel="Redeem"
          confirmVariant="primary"
          busy={redeem.isPending}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (!pending) return
            const reward = pending
            redeem.mutate(reward.id, {
              onSuccess: () => {
                setPending(null)
                showToast(`${reward.title} is yours. Your voucher is above.`)
              },
              onError: (error) => {
                setPending(null)
                showToast(
                  isRepositoryError(error) && error.code === 'insufficient_points'
                    ? 'You don’t have enough points for that yet.'
                    : 'We couldn’t redeem that. Please try again.',
                  { tone: 'error' },
                )
              },
            })
          }}
        >
          {pending && (
            <p>
              This spends {formatPoints(pending.cost)} points at {pending.partner}. You will have{' '}
              {formatPoints(summary.data.balance - pending.cost)} left.
            </p>
          )}
        </ConfirmDialog>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Rewards"
        description="Earn points at every table. Spend them on the perks you’ll actually use."
        actions={
          <ButtonLink to="/invite" variant="secondary">
            Invite friends
          </ButtonLink>
        }
      />
      {body}
    </>
  )
}
