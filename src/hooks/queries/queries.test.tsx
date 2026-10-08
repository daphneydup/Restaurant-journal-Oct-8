import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '@/app/providers'
import type { Repositories } from '@/data'
import { createTestQueryClient } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'
import {
  useAddToGoBack,
  useCreateRestaurant,
  useCreateVisit,
  useDeleteRestaurant,
  useDietLenses,
  useGoBackEntry,
  useProfile,
  useRestaurant,
  useRestaurantVisits,
  useRestaurants,
  useUpdateProfile,
} from '.'
import { useRepositories } from '@/data/repositoryContext'

function setup(repositories: Repositories = createTestRepositories()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders repositories={repositories} queryClient={createTestQueryClient()}>
      {children}
    </AppProviders>
  )
  return { repositories, wrapper }
}

describe('query hooks', () => {
  it('start in a loading state, then deliver data from the injected repositories', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useRestaurants(), { wrapper })

    expect(result.current.isPending).toBe(true)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.length).toBeGreaterThanOrEqual(8)
  })

  it('surface repository failures as an error state', async () => {
    const repositories = createTestRepositories()
    repositories.dev?.setSimulateErrors(true)
    const { wrapper } = setup(repositories)
    const { result } = renderHook(() => useRestaurants(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ code: 'unavailable' })
  })

  it('useRestaurant resolves null for an unknown id and stays idle without an id', async () => {
    const { wrapper } = setup()
    const missing = renderHook(() => useRestaurant('ghost'), { wrapper })
    await waitFor(() => expect(missing.result.current.isSuccess).toBe(true))
    expect(missing.result.current.data).toBeNull()

    const idle = renderHook(() => useRestaurant(undefined), { wrapper })
    expect(idle.result.current.fetchStatus).toBe('idle')
  })

  it('useRestaurantVisits returns that restaurant’s visits newest first', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useRestaurantVisits('r-sprout'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(3)
    expect(result.current.data?.[0]?.id).toBe('v-sprout-1')
  })

  it('useDietLenses returns data-driven lenses in display order', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => useDietLenses(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((l) => l.id).slice(0, 3)).toEqual([
      'vegan',
      'vegetarian',
      'steak',
    ])
  })

  it('creating a restaurant refreshes the list query', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({ list: useRestaurants(), create: useCreateRestaurant() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    const before = result.current.list.data?.length ?? 0

    await act(async () => {
      await result.current.create.mutateAsync({
        name: 'Brand New Bistro',
        neighborhood: 'Uptown',
        city: 'Dallas',
        priceTier: 3,
      })
    })

    await waitFor(() => expect(result.current.list.data?.length).toBe(before + 1))
    expect(result.current.list.data?.some((r) => r.name === 'Brand New Bistro')).toBe(true)
  })

  it('creating a visit refreshes that restaurant’s visit list', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({ visits: useRestaurantVisits('r-noodle'), create: useCreateVisit() }),
      {
        wrapper,
      },
    )
    await waitFor(() => expect(result.current.visits.data).toHaveLength(1))

    await act(async () => {
      await result.current.create.mutateAsync({
        restaurantId: 'r-noodle',
        date: '2026-10-08',
        ratings: [{ lensId: 'vegan', rating: 5 }],
        workedForEveryone: 'yes',
        priceTier: 1,
        companions: [],
        photoUrls: [],
      })
    })

    await waitFor(() => expect(result.current.visits.data).toHaveLength(2))
  })

  it('go-back: adding flips useGoBackEntry from null to the entry', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({ entry: useGoBackEntry('r-noodle'), add: useAddToGoBack() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.entry.isSuccess).toBe(true))
    expect(result.current.entry.data).toBeNull()

    await act(async () => {
      await result.current.add.mutateAsync({ restaurantId: 'r-noodle' })
    })
    await waitFor(() =>
      expect(result.current.entry.data).toMatchObject({ restaurantId: 'r-noodle' }),
    )
  })

  it('deleting a restaurant also clears its cached visits and go-back entry', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({
        visits: useRestaurantVisits('r-fig'),
        entry: useGoBackEntry('r-fig'),
        remove: useDeleteRestaurant(),
      }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.visits.data).toHaveLength(2))
    await waitFor(() => expect(result.current.entry.data).not.toBeNull())

    await act(async () => {
      await result.current.remove.mutateAsync('r-fig')
    })

    await waitFor(() => expect(result.current.visits.data).toEqual([]))
    await waitFor(() => expect(result.current.entry.data).toBeNull())
  })

  it('profile updates are written straight into the cache', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ profile: useProfile(), update: useUpdateProfile() }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.profile.data?.displayName).toBe('Summer'))

    await act(async () => {
      await result.current.update.mutateAsync({ displayName: 'Sam' })
    })
    await waitFor(() => expect(result.current.profile.data?.displayName).toBe('Sam'))
  })

  it('useRepositories throws a helpful error outside the provider', () => {
    expect(() => renderHook(() => useRepositories())).toThrow(/RepositoryProvider/)
  })
})
