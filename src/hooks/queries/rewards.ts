import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRepositories } from '@/data/repositoryContext'
import { queryKeys } from './queryKeys'

export function useRewardsSummary() {
  const { rewards } = useRepositories()
  return useQuery({ queryKey: queryKeys.rewards.summary(), queryFn: () => rewards.getSummary() })
}

export function useRewardCatalog() {
  const { rewards } = useRepositories()
  return useQuery({ queryKey: queryKeys.rewards.catalog(), queryFn: () => rewards.listCatalog() })
}

export function useVouchers() {
  const { rewards } = useRepositories()
  return useQuery({ queryKey: queryKeys.rewards.vouchers(), queryFn: () => rewards.listVouchers() })
}

export function useReferral() {
  const { rewards } = useRepositories()
  return useQuery({ queryKey: queryKeys.rewards.referral(), queryFn: () => rewards.getReferral() })
}

/** Spends points on a perk. Refreshes the balance, history and vouchers. */
export function useRedeemReward() {
  const { rewards } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rewardId: string) => rewards.redeem(rewardId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all }),
  })
}

export function useMarkVoucherUsed() {
  const { rewards } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (voucherId: string) => rewards.markVoucherUsed(voucherId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all }),
  })
}

export function useClaimReferral() {
  const { rewards } = useRepositories()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => rewards.claimReferral(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rewards.all }),
  })
}
