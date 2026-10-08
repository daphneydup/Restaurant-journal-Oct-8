import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/data/repositoryContext'
import type { DishInput, DishPatch } from '@/types'
import { queryKeys } from './queryKeys'

export function useDishes() {
  const { dishes } = useRepositories()
  return useQuery({ queryKey: queryKeys.dishes.list(), queryFn: () => dishes.list() })
}

/** Resolves `null` (not an error) when the dish doesn't exist. */
export function useDish(id: string | undefined) {
  const { dishes } = useRepositories()
  return useQuery({
    queryKey: queryKeys.dishes.detail(id ?? ''),
    queryFn: () => dishes.getById(id ?? ''),
    enabled: Boolean(id),
  })
}

export function useRestaurantDishes(restaurantId: string | undefined) {
  const { dishes } = useRepositories()
  return useQuery({
    queryKey: queryKeys.dishes.byRestaurant(restaurantId ?? ''),
    queryFn: () => dishes.listByRestaurant(restaurantId ?? ''),
    enabled: Boolean(restaurantId),
  })
}

export function useCreateDish() {
  const { dishes } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DishInput) => dishes.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dishes.all }),
  })
}

export function useUpdateDish() {
  const { dishes } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: DishPatch }) => dishes.update(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dishes.all }),
  })
}

export function useDeleteDish() {
  const { dishes } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => dishes.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.dishes.all }),
  })
}
