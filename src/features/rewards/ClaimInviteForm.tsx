import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Spinner, TextField, useToast } from '@/components'
import { isRepositoryError } from '@/data'
import { useAccount, useClaimReferral, useReferral } from '@/hooks/queries'
import { referralCodeSchema } from '@/types'

/** For someone who was given a code by hand instead of a link. Members only, once. */
export function ClaimInviteForm() {
  const account = useAccount()
  const referral = useReferral()
  const claim = useClaimReferral()
  const { showToast } = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string>()

  if (!account.data || !referral.data) return null

  if (referral.data.hasClaimed) {
    return (
      <p className="text-sm text-ink-muted">You’ve already used a friend’s invite. Thank you!</p>
    )
  }
  if (account.data.isGuest) {
    return (
      <p className="text-sm text-ink-muted">
        Got a friend’s code?{' '}
        <Link className="font-semibold text-primary-strong underline" to="/signup">
          Create an account
        </Link>{' '}
        first. Invites are for members.
      </p>
    )
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = referralCodeSchema.safeParse(code)
    if (!parsed.success) {
      setError('Enter a code like TFE-ABC234')
      return
    }
    setError(undefined)
    claim.mutate(parsed.data, {
      onSuccess: ({ pointsAwarded }) => {
        setCode('')
        showToast(`Welcome bonus: ${pointsAwarded} points added`)
      },
      onError: (failure) => {
        if (!isRepositoryError(failure) || failure.code === 'unavailable') {
          setError('We couldn’t reach the server. Please try again.')
        } else {
          setError(failure.message)
        }
      },
    })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <TextField
        label="A friend’s invite code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        error={error}
        placeholder="TFE-ABC234"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="submit" disabled={claim.isPending} className="self-start">
        {claim.isPending ? (
          <>
            <Spinner label="Applying" className="text-on-primary" /> Applying…
          </>
        ) : (
          'Apply code'
        )}
      </Button>
    </form>
  )
}
