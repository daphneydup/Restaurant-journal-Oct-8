import { referralCodeSchema } from '@/types'

/**
 * The invite code someone arrived with, kept until they have an account and it can be claimed.
 * Stored in localStorage so it survives the sign-up and email-confirmation round trip. Every
 * access is wrapped because storage can be blocked (private windows) or full.
 */
const KEY = 'tfe:pending-ref'
const EVENT = 'tfe:pending-ref-change'

let memory: string | null = null // used when storage is unavailable

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY) ?? memory
  } catch {
    return memory
  }
}

function notify() {
  window.dispatchEvent(new Event(EVENT))
}

/** The remembered code, or null. Anything that isn't a well-formed code is ignored. */
export function pendingReferral(): string | null {
  const parsed = referralCodeSchema.safeParse(read() ?? '')
  return parsed.success ? parsed.data : null
}

export function rememberReferral(code: string): boolean {
  const parsed = referralCodeSchema.safeParse(code)
  if (!parsed.success) return false
  memory = parsed.data
  try {
    window.localStorage.setItem(KEY, parsed.data)
  } catch {
    // Kept in memory for this tab instead.
  }
  notify()
  return true
}

export function forgetReferral() {
  memory = null
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    // Nothing to clean up.
  }
  notify()
}

/** For `useSyncExternalStore`: re-render when the code changes here or in another tab. */
export function subscribeToPendingReferral(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** The link a person shares: opens the join screen with their code filled in. */
export function referralLink(code: string, origin = window.location.origin): string {
  return `${origin}/join?ref=${encodeURIComponent(code)}`
}
