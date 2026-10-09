import type { User } from '@supabase/supabase-js'
import { RepositoryError } from '../errors'
import type { AccountChange, AuthEvent, AuthRepository } from '../repositories'
import { parseOrThrow } from '../validation'
import {
  authUserSchema,
  credentialsSchema,
  emailSchema,
  passwordSchema,
  type AuthUser,
} from '@/types'
import { unwrap, type SupabaseContext } from './context'
import { mapAuthError } from './errors'

/** Supabase user -> the app's AuthUser. A "guest" is an anonymous Supabase user. */
export function toAuthUser(user: User): AuthUser {
  return parseOrThrow(authUserSchema, {
    id: user.id,
    email: user.email || null,
    pendingEmail: user.new_email ?? null,
    isGuest: user.is_anonymous === true,
    createdAt: user.created_at,
  })
}

export function createSupabaseAuthRepository(ctx: SupabaseContext): AuthRepository {
  const { auth } = ctx.client
  const listeners = new Set<(event: AuthEvent, user: AuthUser | null) => void>()
  let recovering = false

  function emit(event: AuthEvent, user: AuthUser | null) {
    for (const listener of listeners) listener(event, user)
  }

  // Subscribed for the life of the app. (Don't call Supabase from inside this callback: the
  // client holds a lock while it runs. We only translate and forward.)
  auth.onAuthStateChange((event, session) => {
    const user = session ? toAuthUser(session.user) : null
    switch (event) {
      case 'SIGNED_IN':
        emit('signed_in', user)
        break
      case 'SIGNED_OUT':
        recovering = false
        emit('signed_out', null)
        break
      case 'USER_UPDATED':
        emit('updated', user)
        break
      case 'PASSWORD_RECOVERY':
        recovering = true
        emit('password_recovery', user)
        break
      default:
        break // INITIAL_SESSION and TOKEN_REFRESHED don't change who is signed in
    }
  })

  async function current(): Promise<AuthUser | null> {
    const { data, error } = await auth.getSession()
    if (error) throw mapAuthError(error)
    return data.session ? toAuthUser(data.session.user) : null
  }

  async function requireMember(): Promise<AuthUser> {
    const user = await current()
    if (!user || user.isGuest) {
      throw new RepositoryError('not_authenticated', 'Create an account or log in first.')
    }
    return user
  }

  /** Runs an update-user call and turns the result into an AccountChange. */
  async function update(attributes: { email?: string; password?: string }): Promise<AccountChange> {
    const { data, error } = await auth.updateUser(attributes)
    if (error) throw mapAuthError(error)
    const user = toAuthUser(data.user)
    return { user, needsEmailConfirmation: data.user.new_email != null }
  }

  return {
    getCurrentUser: current,

    async signUp(input) {
      const credentials = parseOrThrow(credentialsSchema, input)
      await ctx.userId() // make sure there is a guest session to upgrade
      const existing = await current()
      if (existing && !existing.isGuest) {
        throw new RepositoryError(
          'validation',
          'You already have an account. Log out to create another.',
        )
      }
      // Giving the guest an email + password turns the SAME user into a member, so the journal
      // they have already logged stays theirs. If the project asks for email confirmation, the
      // user stays a guest until they click the link (then `needsEmailConfirmation` is true).
      const change = await update(credentials)
      return {
        ...change,
        needsEmailConfirmation: change.needsEmailConfirmation || change.user.isGuest,
      }
    },

    async signIn(input) {
      const credentials = parseOrThrow(credentialsSchema, input)
      const { data, error } = await auth.signInWithPassword(credentials)
      if (error) throw mapAuthError(error)
      return toAuthUser(data.user)
    },

    async signOut() {
      const { error } = await auth.signOut()
      if (error && error.name !== 'AuthSessionMissingError') throw mapAuthError(error)
    },

    async updateEmail(email) {
      const next = parseOrThrow(emailSchema, email).toLowerCase()
      await requireMember()
      return update({ email: next })
    },

    async updatePassword(password) {
      const next = parseOrThrow(passwordSchema, password)
      await requireMember()
      await update({ password: next })
      recovering = false
    },

    async requestPasswordReset(email) {
      const address = parseOrThrow(emailSchema, email).toLowerCase()
      const redirectTo =
        typeof window === 'undefined' ? undefined : `${window.location.origin}/reset-password`
      const { error } = await auth.resetPasswordForEmail(
        address,
        redirectTo ? { redirectTo } : undefined,
      )
      if (error) throw mapAuthError(error)
    },

    isRecovering: () => recovering,

    async deleteAccount() {
      // A database function removes the auth user; every table cascades from it.
      await unwrap(ctx, () => ctx.client.rpc('delete_my_account'))
      // The session now points at a user that no longer exists: clear it locally.
      await auth.signOut({ scope: 'local' }).catch(() => undefined)
    },

    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
