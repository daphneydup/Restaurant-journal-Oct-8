import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/data/repositoryContext'
import type { RestaurantInput, RestaurantPatch } from '@/types'
import { queryKeys } from './queryKeys'

export function useRestaurants() {
  const { restaurants } = useRepositories()
  return useQuery({ queryKey: queryKeys.restaurants.list(), queryFn: () => restaurants.list() })
}

/** Resolves `null` (not an error) when the restaurant doesn't exist. */
export function useRestaurant(id: string | undefined) {
  const { restaurants } = useRepositories()
  return useQuery({
    queryKey: queryKeys.restaurants.detail(id ?? ''),
    queryFn: () => restaurants.getById(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useCreateRestaurant() {
  const { restaurants } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RestaurantInput) => restaurants.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all }),
  })
}

export function useUpdateRestaurant() {
  const { restaurants } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RestaurantPatch }) =>
      restaurants.update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all }),
  })
}

/** Deleting a restaurant also removes its visits, dishes and go-back entry. */
export function useDeleteRestaurant() {
  const { restaurants } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => restaurants.remove(id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.restaurants.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.visits.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dishes.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.goBack.all }),
      ]),
  })
}
