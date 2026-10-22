import { X } from 'lucide-react'
import { useState } from 'react'
import { ButtonLink, IconButton } from '@/components'
import { useAccount } from '@/hooks/queries'

const KEY = 'tfe:guest-banner-dismissed'

function wasDismissed() {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * A gentle, dismissible nudge on My Spots for guests who already have a journal worth keeping.
 * (Remembering the dismissal is a per-browser convenience, so it lives in localStorage.)
 */
export function GuestBanner() {
  const account = useAccount()
  const [dismissed, setDismissed] = useState(wasDismissed)
  const isGuest = account.data === null || account.data?.isGuest === true
  if (dismissed || account.isPending || account.isError || !isGuest) return null

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(KEY, '1')
    } catch {
      // Not remembered across visits, which is fine.
    }
  }

  return (
    <aside
      aria-label="Save your journal"
      className="mb-5 flex items-start gap-2 rounded-card bg-saffron-soft p-4 text-saffron-strong"
    >
      <div className="flex-1">
        <p className="font-medium">Your journal is saved only in this browser.</p>
        <p className="mb-3 text-sm">
          Create a free account to keep it safe and use it on any device.
        </p>
        <div className="flex gap-2">
          {/* Visible text is the short "Account" from the design; the accessible name says what it does. */}
          <ButtonLink
            to="/signup"
            aria-label="Create an account"
            className="max-w-34 min-w-0 flex-1"
          >
            Account
          </ButtonLink>
          <ButtonLink to="/login" className="max-w-34 min-w-0 flex-1">
            Login
          </ButtonLink>
        </div>
      </div>
      <IconButton label="Dismiss" onClick={dismiss}>
        <X aria-hidden className="size-5" />
      </IconButton>
    </aside>
  )
}
