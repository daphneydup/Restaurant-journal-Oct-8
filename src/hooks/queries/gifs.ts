import { useInfiniteQuery } from '@tanstack/react-query'
import { useRepositories } from '@/data/repositoryContext'
import { queryKeys } from './queryKeys'

const PAGE_SIZE = 12

/**
 * GIF search, a page at a time. An empty query shows what is trending. Results are kept for five
 * minutes so reopening the picker is instant and GIPHY isn't asked the same thing again.
 */
export function useGifSearch(query: string, enabled = true) {
  const { gifs } = useRepositories()
  const q = query.trim()
  return useInfiniteQuery({
    queryKey: queryKeys.gifs.search(q),
    queryFn: ({ pageParam }) => gifs.search({ query: q, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    staleTime: 5 * 60_000,
    enabled,
  })
}
