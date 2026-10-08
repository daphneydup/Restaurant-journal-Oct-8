import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/data/repositoryContext'
import type { UserPatch } from '@/types'
import { queryKeys } from './queryKeys'

export function useProfile() {
  const { user } = useRepositories()
  return useQuery({ queryKey: queryKeys.profile.current(), queryFn: () => user.getCurrent() })
}

export function useUpdateProfile() {
  const { user } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: UserPatch) => user.update(patch),
    onSuccess: (updated) => queryClient.setQueryData(queryKeys.profile.current(), updated),
  })
}
