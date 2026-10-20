import { Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Card,
  ErrorState,
  LoadingRegion,
  PageHeader,
  Skeleton,
  useToast,
} from '@/components'
import { CopyLinkPanel } from '@/features/share/CopyLinkPanel'
import { ShareActions } from '@/features/share/ShareActions'
import { inviteShareContent } from '@/features/share/shareContent'
import { useProfile, useReferral } from '@/hooks/queries'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { copyToClipboard } from '@/lib/clipboard'
import { POINTS } from '@/lib/rewardRules'
import { ClaimInviteForm } from './ClaimInviteForm'
import { formatPoints } from './rewardMeta'

function CodeCard({ code }: { code: string }) {
  const { showToast } = useToast()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    if (await copyToClipboard(code)) {
      setCopied(true)
      showToast('Invite code copied')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2500)
    } else {
      showToast('Couldn’t copy automatically. Select the code and copy it.', { tone: 'error' })
    }
  }

  return (
    <section
      aria-labelledby="code-heading"
      className="rounded-card bg-surface p-6 text-center shadow-raised md:p-8"
    >
      <h2
        id="code-heading"
        className="font-sans text-xs font-semibold tracking-[0.2em] text-primary-strong uppercase"
      >
        Your invite code
      </h2>
      <p className="my-3 font-mono text-3xl tracking-[0.22em] break-all text-ink md:text-4xl">
        {code}
      </p>
      <Button variant="secondary" onClick={() => void copy()}>
        {copied ? (
          <>
            <Check aria-hidden className="size-4" /> Copied
          </>
        ) : (
          <>
            <Copy aria-hidden className="size-4" /> Copy code
          </>
        )}
      </Button>
    </section>
  )
}

export function InvitePage() {
  useDocumentTitle('Invite friends')
  const referral = useReferral()
  const profile = useProfile()

  let body
  if (referral.isError) {
    body = (
      <ErrorState title="We couldn’t load your invite" onRetry={() => void referral.refetch()} />
    )
  } else if (!referral.data) {
    body = (
      <LoadingRegion label="Loading your invite" className="flex flex-col gap-4">
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-28 rounded-card" />
      </LoadingRegion>
    )
  } else {
    const { code, invitedCount, pointsEarned } = referral.data
    body = (
      <div className="flex flex-col gap-6">
        <CodeCard code={code} />
        <CopyLinkPanel
          path={`/join?ref=${encodeURIComponent(code)}`}
          label="Your invite link"
          note="Friends who open this link and create an account both earn the bonus."
        />

        <ShareActions content={inviteShareContent(profile.data?.displayName ?? 'A friend')} />

        <Card>
          <h2 className="text-lg">How it works</h2>
          <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-ink-muted">
            <li>Send a friend your link or code.</li>
            <li>They create an account with it.</li>
            <li>You each get {formatPoints(POINTS.referral)} points to spend on perks.</li>
          </ol>
        </Card>

        <Card aria-label="Your invites">
          <p className="font-display text-3xl">{invitedCount}</p>
          <p className="text-ink-muted">
            {invitedCount === 1 ? 'friend has' : 'friends have'} joined with your invite, earning
            you {formatPoints(pointsEarned)} points.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 text-lg">Have a friend’s code?</h2>
          <ClaimInviteForm />
        </Card>
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Invite friends"
        description={`Bring your table along. You each earn ${formatPoints(POINTS.referral)} points.`}
      />
      {body}
    </>
  )
}
