import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { AppProviders } from '@/app/providers'
import { createTestQueryClient } from '@/test/renderWithRouter'
import { createTestRepositories } from '@/test/testRepositories'
import { useCreateVisit, useLogVisit, useRedeemReward, useRewardsSummary } from '.'

function setup() {
  const repositories = createTestRepositories()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders repositories={repositories} queryClient={createTestQueryClient()}>
      {children}
    </AppProviders>
  )
  return { repositories, wrapper }
}

const visit = {
  date: '2026-10-08',
  ratings: [{ lensId: 'vegan', rating: 5 as const }],
  workedForEveryone: 'yes' as const,
  priceTier: 2 as const,
  companions: [],
  photoUrls: [],
}

describe('rewards hooks keep the balance fresh', () => {
  it('refreshes the balance after logging a visit', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(() => ({ summary: useRewardsSummary(), log: useLogVisit() }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.summary.data).toBeDefined())
    const before = result.current.summary.data!.balance

    await act(async () => {
      await result.current.log.mutateAsync({
        restaurant: { mode: 'existing', restaurantId: 'r-noodle' },
        visit,
        dishes: [],
        addToGoBack: false,
      })
    })
    await waitFor(() => expect(result.current.summary.data!.balance).toBe(before + 50))
  })

  it('refreshes the balance after saving a visit directly', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({ summary: useRewardsSummary(), create: useCreateVisit() }),
      {
        wrapper,
      },
    )
    await waitFor(() => expect(result.current.summary.data).toBeDefined())
    const before = result.current.summary.data!.balance
    await act(async () => {
      await result.current.create.mutateAsync({ restaurantId: 'r-noodle', ...visit })
    })
    await waitFor(() => expect(result.current.summary.data!.balance).toBe(before + 50))
  })

  it('refreshes the balance after redeeming, even when the redemption is refused', async () => {
    const { wrapper } = setup()
    const { result } = renderHook(
      () => ({ summary: useRewardsSummary(), redeem: useRedeemReward() }),
      {
        wrapper,
      },
    )
    await waitFor(() => expect(result.current.summary.data).toBeDefined())
    const before = result.current.summary.data!.balance

    await act(async () => {
      await result.current.redeem.mutateAsync('drink-marigold')
    })
    await waitFor(() => expect(result.current.summary.data!.balance).toBe(before - 120))

    await act(async () => {
      await result.current.redeem.mutateAsync('tasting-copper').catch(() => undefined)
    })
    await waitFor(() =>
      expect(result.current.redeem.error).toMatchObject({ code: 'insufficient_points' }),
    )
  })
})
