import type { AuthUser, Credentials } from '@/types'

export type AuthEvent =
  /** Someone signed in (including the automatic guest session). */
  | 'signed_in'
  | 'signed_out'
  /** The account changed (email, password, or a guest became a member). */
  | 'updated'
  /** The user arrived from a password-reset email and may now choose a new password. */
  | 'password_recovery'

export interface AccountChange {
  user: AuthUser
  /** True when the change only takes effect after the user clicks a link emailed to them. */
  needsEmailConfirmation: boolean
}

/**
 * Account CRUD plus sign in / out. Every method may reject with a RepositoryError: the useful
 * codes here are `invalid_credentials`, `email_taken`, `weak_password`, `email_not_confirmed`,
 * `rate_limited`, `not_authenticated` and `unavailable`.
 */
export interface AuthRepository {
  /** READ. The current session's user, or null when nobody (not even a guest) is signed in yet. */
  getCurrentUser(): Promise<AuthUser | null>

  /**
   * CREATE. Turns the current guest into a member in place, so their data comes with them.
   * Rejects with `email_taken` if the address already has an account.
   */
  signUp(credentials: Credentials): Promise<AccountChange>

  /** Signs in to an existing account. Replaces the current (guest) session. */
  signIn(credentials: Credentials): Promise<AuthUser>

  signOut(): Promise<void>

  /** UPDATE. Members only (`not_authenticated` for guests). */
  updateEmail(email: string): Promise<AccountChange>
  /** UPDATE. Members only. */
  updatePassword(password: string): Promise<void>

  /** Emails a reset link. Resolves the same whether or not the address has an account. */
  requestPasswordReset(email: string): Promise<void>
  /** True while the user is in the password-reset flow reached from an emailed link. */
  isRecovering(): boolean

  /** DELETE. Permanently removes the account (or guest) and all of its data, then signs out. */
  deleteAccount(): Promise<void>

  /** Subscribe to sign-in / sign-out / account changes. Returns an unsubscribe function. */
  onChange(listener: (event: AuthEvent, user: AuthUser | null) => void): () => void
}
