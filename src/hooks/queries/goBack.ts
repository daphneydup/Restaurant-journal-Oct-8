import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/data/repositoryContext'
import type { GoBackEntryInput, GoBackEntryPatch } from '@/types'
import { queryKeys } from './queryKeys'

export function useGoBackEntries() {
  const { goBack } = useRepositories()
  return useQuery({ queryKey: queryKeys.goBack.list(), queryFn: () => goBack.list() })
}

/** The go-back entry for one restaurant, or `null` if it isn't flagged. */
export function useGoBackEntry(restaurantId: string | undefined) {
  const { goBack } = useRepositories()
  return useQuery({
    queryKey: queryKeys.goBack.byRestaurant(restaurantId ?? ''),
    queryFn: () => goBack.getByRestaurantId(restaurantId ?? ''),
    enabled: Boolean(restaurantId),
  })
}

export function useAddToGoBack() {
  const { goBack } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: GoBackEntryInput) => goBack.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.goBack.all }),
  })
}

export function useUpdateGoBackEntry() {
  const { goBack } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: GoBackEntryPatch }) =>
      goBack.update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.goBack.all }),
  })
}

export function useRemoveFromGoBack() {
  const { goBack } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => goBack.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.goBack.all }),
  })
}
