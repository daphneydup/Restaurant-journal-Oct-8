import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/data/repositoryContext'
import type { Credentials } from '@/types'
import { queryKeys } from './queryKeys'

/**
 * READ. Who is signed in: undefined while loading, null if nobody yet (treat as a guest), or the
 * user. `AuthSync` keeps this in step with sign-ins and sign-outs from anywhere.
 */
export function useAccount() {
  const { auth } = useRepositories()
  return useQuery({
    queryKey: queryKeys.account.current(),
    queryFn: () => auth.getCurrentUser(),
    staleTime: Infinity,
  })
}

/** CREATE. A guest becomes a member in place; their journal comes with them. */
export function useSignUp() {
  const { auth } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: Credentials) => auth.signUp(credentials),
    onSuccess: ({ user }) => queryClient.setQueryData(queryKeys.account.current(), user),
  })
}

export function useSignIn() {
  const { auth } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (credentials: Credentials) => auth.signIn(credentials),
    onSuccess: (user) => queryClient.setQueryData(queryKeys.account.current(), user),
  })
}

export function useSignOut() {
  const { auth } = useRepositories()
  return useMutation({ mutationFn: () => auth.signOut() })
}

/** UPDATE. */
export function useUpdateEmail() {
  const { auth } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => auth.updateEmail(email),
    onSuccess: ({ user }) => queryClient.setQueryData(queryKeys.account.current(), user),
  })
}

export function useUpdatePassword() {
  const { auth } = useRepositories()
  return useMutation({ mutationFn: (password: string) => auth.updatePassword(password) })
}

export function useRequestPasswordReset() {
  const { auth } = useRepositories()
  return useMutation({ mutationFn: (email: string) => auth.requestPasswordReset(email) })
}

/** DELETE. Removes the account and everything in it. */
export function useDeleteAccount() {
  const { auth } = useRepositories()
  return useMutation({ mutationFn: () => auth.deleteAccount() })
}

/** True while the user is on the password-reset flow reached from an emailed link. */
export function useIsRecovering() {
  const { auth } = useRepositories()
  const [recovering, setRecovering] = useState(() => auth.isRecovering())
  useEffect(
    () =>
      auth.onChange((event) => {
        if (event === 'password_recovery') setRecovering(true)
        if (event === 'signed_out') setRecovering(false)
      }),
    [auth],
  )
  return recovering
}
