import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/data/repositoryContext'
import type { LogVisitInput, VisitInput, VisitPatch } from '@/types'
import { queryKeys } from './queryKeys'

export function useVisits() {
  const { visits } = useRepositories()
  return useQuery({ queryKey: queryKeys.visits.list(), queryFn: () => visits.list() })
}

export function useRestaurantVisits(restaurantId: string | undefined) {
  const { visits } = useRepositories()
  return useQuery({
    queryKey: queryKeys.visits.byRestaurant(restaurantId ?? ''),
    queryFn: () => visits.listByRestaurant(restaurantId ?? ''),
    enabled: Boolean(restaurantId),
  })
}

export function useCreateVisit() {
  const { visits } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VisitInput) => visits.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.visits.all }),
  })
}

export function useUpdateVisit() {
  const { visits } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: VisitPatch }) => visits.update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.visits.all }),
  })
}

/** Deleting a visit also removes the dishes logged on it. */
export function useDeleteVisit() {
  const { visits } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => visits.remove(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.visits.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dishes.all }),
      ]),
  })
}

/**
 * Saves a whole Log a Visit submission (restaurant if new, visit, dishes, go-back) in one
 * atomic call, then refreshes everything it may have touched.
 */
export function useLogVisit() {
  const { visits } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LogVisitInput) => visits.logVisit(input),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.visits.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dishes.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.goBack.all }),
      ]),
  })
}
