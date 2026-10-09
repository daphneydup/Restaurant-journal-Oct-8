import { UserRound } from 'lucide-react'
import { ButtonLink, Card } from '@/components'
import { useAccount } from '@/hooks/queries'

/** On Profile: who is signed in, and the way to create or manage an account. */
export function AccountSummaryCard() {
  const account = useAccount()
  if (account.isPending || account.isError) return null // quiet: Profile has its own states
  const user = account.data
  const isGuest = user === null || user.isGuest

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <UserRound aria-hidden className="mt-0.5 size-5 shrink-0 text-basil-strong" />
        <div>
          <h2 className="font-sans text-base font-semibold">
            {isGuest ? 'You’re using a guest journal' : `Logged in as ${user?.email ?? ''}`}
          </h2>
          <p className="text-sm text-ink-muted">
            {isGuest
              ? 'It’s saved only in this browser. Create an account to keep it safe and use it anywhere.'
              : 'Change your email or password, log out, or delete your account.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {isGuest ? (
          <>
            <ButtonLink to="/signup">Create an account</ButtonLink>
            <ButtonLink to="/login" variant="secondary">
              Log in
            </ButtonLink>
          </>
        ) : (
          <ButtonLink to="/account" variant="secondary">
            Manage account
          </ButtonLink>
        )}
      </div>
    </Card>
  )
}
