import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useRepositories } from '@/data/repositoryContext'
import { queryKeys } from '@/hooks/queries'

/**
 * Keeps the app in step with who is signed in. Renders nothing.
 *
 * Whenever the PERSON changes (logging out, or logging in as someone else) every cached screen is
 * thrown away and reloaded, so nobody ever sees the previous person's journal. When the same
 * person merely changes their email or password, or a guest becomes a member in place (same id),
 * nothing is reloaded.
 */
export function AuthSync() {
  const { auth } = useRepositories()
  const queryClient = useQueryClient()
  const lastUserId = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    void auth
      .getCurrentUser()
      .then((user) => {
        if (active) lastUserId.current ??= user?.id ?? null
      })
      .catch(() => undefined) // the screens show their own error states

    const unsubscribe = auth.onChange((event, user) => {
      queryClient.setQueryData(queryKeys.account.current(), user)

      const previous = lastUserId.current
      lastUserId.current = user?.id ?? null
      const personChanged =
        event === 'signed_out' || (previous !== null && user !== null && previous !== user.id)
      if (personChanged) {
        void queryClient.resetQueries({ predicate: (query) => query.queryKey[0] !== 'auth' })
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [auth, queryClient])

  return null
}
