import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useToast } from '@/components'
import { isRepositoryError } from '@/data'
import { useAccount, useClaimReferral } from '@/hooks/queries'
import { forgetReferral, pendingReferral, subscribeToPendingReferral } from '@/lib/pendingReferral'

/**
 * Turns an invite link into points, with no extra step for the person. When someone opens
 * `/join?ref=CODE` the code is remembered; as soon as they are a signed-in member (not a guest)
 * it is claimed once, and forgotten. Renders nothing.
 *
 * A network failure keeps the code so the next visit tries again; any answer from the server
 * (claimed, already used, unknown code) is final and clears it.
 */
export function ReferralClaimer() {
  const account = useAccount()
  const { mutate: claimCode } = useClaimReferral()
  const { showToast } = useToast()
  const code = useSyncExternalStore(subscribeToPendingReferral, pendingReferral, () => null)
  const inFlight = useRef<string | null>(null)

  const isMember = Boolean(account.data && !account.data.isGuest)

  useEffect(() => {
    if (!isMember || !code || inFlight.current === code) return
    inFlight.current = code
    claimCode(code, {
      onSuccess: ({ pointsAwarded }) => {
        forgetReferral()
        showToast(`Welcome bonus: ${pointsAwarded} points added`)
      },
      onError: (error) => {
        if (isRepositoryError(error) && error.code === 'unavailable') {
          inFlight.current = null // keep the code; try again on a later visit
          return
        }
        forgetReferral()
        if (isRepositoryError(error) && error.code === 'conflict') {
          showToast('You’ve already used an invite, so this one wasn’t applied.')
        } else if (isRepositoryError(error) && error.code === 'not_found') {
          showToast('That invite code didn’t match anyone.', { tone: 'error' })
        } else if (isRepositoryError(error) && error.code === 'validation') {
          showToast('You can’t use your own invite code.', { tone: 'error' })
        }
      },
    })
  }, [isMember, code, claimCode, showToast])

  return null
}
