import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/data/repositoryContext'

/** Developer controls (reset data, simulate errors). Undefined for real back ends. */
export function useDevControls() {
  return useRepositories().dev
}

/** Restores the demo data, then refreshes every cached screen. */
export function useResetDemoData() {
  const dev = useDevControls()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!dev) throw new Error('Demo data controls are not available.')
      await dev.resetDemoData()
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
