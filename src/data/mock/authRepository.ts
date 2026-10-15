import { randomId } from '@/lib/uuid'
import { RepositoryError } from '../errors'
import type { AccountChange, AuthEvent, AuthRepository } from '../repositories'
import { parseOrThrow } from '../validation'
import { credentialsSchema, emailSchema, passwordSchema, type AuthUser } from '@/types'
import { clone } from './helpers'
import type { MockStore } from './store'

/**
 * DEMO ONLY. These accounts live in this browser's localStorage and exist to show the sign-up /
 * log-in behaviour without a server. They protect nothing: the journal data itself is shared by
 * every "account" in demo mode. Real security comes from the Supabase implementation.
 */
interface Account {
  id: string
  email: string
  passwordHash: string
  createdAt: string
}

interface Session {
  userId: string
  email: string | null
  isGuest: boolean
  createdAt: string
}

interface AuthState {
  accounts: Account[]
  session: Session | null
}

export interface MockAuthOptions {
  store: MockStore
  storage: Pick<Storage, 'getItem' | 'setItem'> | null
  storageKey: string
}

/** Salted with the account id (not the email), so changing your email never changes your password. */
async function hashPassword(accountId: string, password: string): Promise<string> {
  const text = `table-for-everyone:${accountId}:${password}`
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  return text // no Web Crypto (very old browser): fine for a demo store
}

export function createMockAuthRepository({
  store,
  storage,
  storageKey,
}: MockAuthOptions): AuthRepository {
  const listeners = new Set<(event: AuthEvent, user: AuthUser | null) => void>()

  function load(): AuthState | null {
    try {
      const raw = storage?.getItem(storageKey)
      return raw ? (JSON.parse(raw) as AuthState) : null
    } catch {
      return null
    }
  }

  const newGuest = (): Session => ({
    userId: `guest-${randomId()}`,
    email: null,
    isGuest: true,
    createdAt: store.now().toISOString(),
  })

  // Everyone starts as a guest, like the real thing.
  let state: AuthState = load() ?? { accounts: [], session: newGuest() }

  function save(next: AuthState) {
    state = next
    try {
      storage?.setItem(storageKey, JSON.stringify(next))
    } catch {
      // Demo accounts just won't survive a reload if storage is full.
    }
  }

  const toUser = (session: Session): AuthUser => ({
    id: session.userId,
    email: session.email,
    pendingEmail: null,
    isGuest: session.isGuest,
    createdAt: session.createdAt,
  })

  function emit(event: AuthEvent) {
    const user = state.session ? toUser(state.session) : null
    for (const listener of listeners) listener(event, clone(user))
  }

  /** The current session, starting a guest one if there is none (like the first data request). */
  function ensureSession(): Session {
    if (!state.session) {
      save({ ...state, session: newGuest() })
      emit('signed_in')
    }
    return state.session as Session
  }

  function requireMember(): Session {
    const session = state.session
    if (!session || session.isGuest) {
      throw new RepositoryError('not_authenticated', 'Create an account or log in first.')
    }
    return session
  }

  const emailTaken = (email: string, exceptId?: string) =>
    state.accounts.some((a) => a.email === email && a.id !== exceptId)

  return {
    getCurrentUser: () => store.run(() => (state.session ? clone(toUser(state.session)) : null)),

    signUp: (credentials) =>
      store.run(async (): Promise<AccountChange> => {
        const { email, password } = parseOrThrow(credentialsSchema, credentials)
        const session = ensureSession()
        if (!session.isGuest) {
          throw new RepositoryError(
            'validation',
            'You already have an account. Log out to create another.',
          )
        }
        if (emailTaken(email))
          throw new RepositoryError('email_taken', 'That email already has an account.')

        const account: Account = {
          id: session.userId, // the guest becomes the member: same id, so the data comes along
          email,
          passwordHash: await hashPassword(session.userId, password),
          createdAt: session.createdAt,
        }
        save({
          accounts: [...state.accounts, account],
          session: { ...session, email, isGuest: false },
        })
        emit('updated')
        return { user: clone(toUser(state.session as Session)), needsEmailConfirmation: false }
      }),

    signIn: (credentials) =>
      store.run(async () => {
        const { email, password } = parseOrThrow(credentialsSchema, credentials)
        const account = state.accounts.find((a) => a.email === email)
        // Hash even for an unknown email, so both failures take about the same time.
        const hash = await hashPassword(account?.id ?? 'unknown', password)
        if (!account || account.passwordHash !== hash) {
          throw new RepositoryError('invalid_credentials', 'That email and password don’t match.')
        }
        save({
          ...state,
          session: {
            userId: account.id,
            email: account.email,
            isGuest: false,
            createdAt: account.createdAt,
          },
        })
        emit('signed_in')
        return clone(toUser(state.session as Session))
      }),

    signOut: () =>
      store.run(() => {
        save({ ...state, session: null })
        emit('signed_out')
      }),

    updateEmail: (email) =>
      store.run((): AccountChange => {
        const session = requireMember()
        const next = parseOrThrow(emailSchema, email).toLowerCase()
        if (emailTaken(next, session.userId)) {
          throw new RepositoryError('email_taken', 'That email already has an account.')
        }
        save({
          accounts: state.accounts.map((a) =>
            a.id === session.userId ? { ...a, email: next } : a,
          ),
          session: { ...session, email: next },
        })
        emit('updated')
        return { user: clone(toUser(state.session as Session)), needsEmailConfirmation: false }
      }),

    updatePassword: (password) =>
      store.run(async () => {
        const session = requireMember()
        const valid = parseOrThrow(passwordSchema, password)
        const passwordHash = await hashPassword(session.userId, valid)
        save({
          ...state,
          accounts: state.accounts.map((a) =>
            a.id === session.userId ? { ...a, passwordHash } : a,
          ),
        })
        emit('updated')
      }),

    // No email is sent in demo mode, and the answer never reveals whether the address exists.
    requestPasswordReset: (email) =>
      store.run(() => {
        parseOrThrow(emailSchema, email)
      }),

    isRecovering: () => false,

    deleteAccount: () =>
      store.run(() => {
        const session = ensureSession()
        store.wipe() // all of this person's journal goes with them
        save({
          accounts: state.accounts.filter((a) => a.id !== session.userId),
          session: null,
        })
        emit('signed_out')
      }),

    onChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
