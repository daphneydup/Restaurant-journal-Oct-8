import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { ButtonLink, Card, PageHeader } from '@/components'
import { TestimonialCarousel } from '@/features/testimonials/TestimonialCarousel'
import { useAccount } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { rememberReferral } from '@/lib/pendingReferral'
import { POINTS } from '@/lib/rewardRules'
import { referralCodeSchema } from '@/types'
import { formatPoints } from './rewardMeta'

/**
 * Where an invite link lands. It remembers the code (the ReferralClaimer applies it once the
 * person has an account) and explains the offer.
 */
export function JoinPage() {
  useDocumentTitle('You’re invited')
  const [params] = useSearchParams()
  const account = useAccount()
  const parsed = referralCodeSchema.safeParse(params.get('ref') ?? '')
  const code = parsed.success ? parsed.data : null

  useEffect(() => {
    if (code) rememberReferral(code)
  }, [code])

  const member = Boolean(account.data && !account.data.isGuest)

  if (!code) {
    return (
      <>
        <PageHeader title="That invite link looks incomplete" />
        <Card className="flex flex-col items-start gap-4">
          <p className="text-ink-muted">
            Ask your friend to send their link again, or enter their code on the invite screen after
            you sign up.
          </p>
          <ButtonLink to="/">Explore the app</ButtonLink>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="A friend saved you a seat"
        description={`Join with their invite and start with ${formatPoints(POINTS.referral)} bonus points.`}
      />
      <Card className="flex flex-col items-start gap-4">
        <p className="text-ink-muted">
          Table for Everyone is a dining journal for groups with mixed diets. Rate every spot for
          each diet, plan nights out that work for all, and earn points toward free appetizers,
          drinks and dinners.
        </p>
        {member ? (
          <>
            <p>You’re signed in, so your bonus is being added to your account.</p>
            <ButtonLink to="/rewards">See my rewards</ButtonLink>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/signup">Create my account</ButtonLink>
            <ButtonLink to="/login" variant="secondary">
              I already have one
            </ButtonLink>
          </div>
        )}
      </Card>
      <div className="mt-6">
        <TestimonialCarousel />
      </div>
    </>
  )
}
