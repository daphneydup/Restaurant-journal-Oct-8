import { useQuery } from '@tanstack/react-query'
import { useRepositories } from '@/data/repositoryContext'
import { queryKeys } from './queryKeys'

/** All dietary lenses, in display order. Reference data, so it is cached for the session. */
export function useDietLenses() {
  const { lenses } = useRepositories()
  return useQuery({
    queryKey: queryKeys.lenses.list(),
    queryFn: () => lenses.list(),
    staleTime: Infinity,
  })
}
